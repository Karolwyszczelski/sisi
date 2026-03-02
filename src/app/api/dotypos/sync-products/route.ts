// src/app/api/dotypos/sync-products/route.ts
// =============================================
// Product Synchronization from Dotypos to Local DB
// =============================================
//
// This endpoint fetches all products from Dotypos and syncs them
// to the local pos_products table for mapping during order creation.
//
// Usage:
// - Manual: GET /api/dotypos/sync-products
// - With force refresh: GET /api/dotypos/sync-products?force=true
// - Cron job: Can be called periodically (e.g., daily)
// =============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import dotypos from "@/lib/dotypos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ============================================================
   Supabase Client
   ============================================================ */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ============================================================
   Types
   ============================================================ */

interface SyncedProduct {
  pos_id: number;
  name: string;
  price: number;
  barcode: string | null;
  plu: string | null;
  category_id: number;
  vat_rate: number;
  deleted: boolean;
  synced_at: string;
}

/* ============================================================
   GET Handler - Sync Products
   ============================================================ */

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(req.url);
    const force = searchParams.get("force") === "true";
    
    console.log("[Dotypos Sync] Starting product sync...", { force });
    
    // 1. Test connection first
    const connectionTest = await dotypos.testConnection();
    if (!connectionTest.connected) {
      return NextResponse.json(
        { 
          error: "Dotypos not connected",
          message: connectionTest.error,
        },
        { status: 503 }
      );
    }
    
    // 2. Fetch all products from Dotypos
    const products = await dotypos.getAllProducts();
    console.log(`[Dotypos Sync] Fetched ${products.length} products from Dotypos`);
    
    if (products.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "No products found in Dotypos",
        duration: Date.now() - startTime,
      });
    }
    
    // 3. Transform products for local database
    const syncedProducts: SyncedProduct[] = products.map((p) => ({
      pos_id: p.id,
      name: p.name,
      price: p.priceWithVat,
      barcode: p.ean?.[0] || null,
      plu: p.plu?.[0] || null,
      category_id: p.categoryId,
      vat_rate: p.vatRate,
      deleted: p.deleted,
      synced_at: new Date().toISOString(),
    }));
    
    // 4. Upsert to database
    const supabase = getSupabase();
    
    // Process in batches of 100
    const batchSize = 100;
    let totalUpserted = 0;
    const errors: string[] = [];
    
    for (let i = 0; i < syncedProducts.length; i += batchSize) {
      const batch = syncedProducts.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from("pos_products")
        .upsert(batch, { 
          onConflict: "pos_id",
          ignoreDuplicates: false,
        })
        .select("pos_id");
      
      if (error) {
        console.error(`[Dotypos Sync] Batch ${i / batchSize + 1} error:`, error.message);
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
      } else {
        totalUpserted += data?.length || batch.length;
      }
    }
    
    // 5. Also fetch and sync categories
    let categoriesSynced = 0;
    try {
      const { data: categories } = await dotypos.getCategories();
      
      if (categories && categories.length > 0) {
        const categoryData = categories.map((c) => ({
          pos_id: c.id,
          name: c.name,
          parent_id: c.parentCategoryId,
          sort_order: c.sortOrder,
          deleted: c.deleted,
          synced_at: new Date().toISOString(),
        }));
        
        const { error: catError } = await supabase
          .from("pos_categories")
          .upsert(categoryData, { onConflict: "pos_id" });
        
        if (!catError) {
          categoriesSynced = categories.length;
        }
      }
    } catch (catErr) {
      console.warn("[Dotypos Sync] Categories sync skipped:", catErr);
    }
    
    const duration = Date.now() - startTime;
    
    console.log(`[Dotypos Sync] Completed in ${duration}ms:`, {
      products: totalUpserted,
      categories: categoriesSynced,
      errors: errors.length,
    });
    
    return NextResponse.json({
      success: errors.length === 0,
      synced: {
        products: totalUpserted,
        categories: categoriesSynced,
      },
      total: products.length,
      errors: errors.length > 0 ? errors : undefined,
      duration,
    });
    
  } catch (error) {
    console.error("[Dotypos Sync] Error:", error);
    
    return NextResponse.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

/* ============================================================
   POST Handler - Sync with options
   ============================================================ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    
    // Support POST with options
    const url = new URL(req.url);
    if (body.force) {
      url.searchParams.set("force", "true");
    }
    
    // Delegate to GET handler
    const getReq = new NextRequest(url, {
      method: "GET",
      headers: req.headers,
    });
    
    return GET(getReq);
    
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
