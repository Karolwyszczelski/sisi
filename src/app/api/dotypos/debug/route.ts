// src/app/api/dotypos/debug/route.ts
// Temporary debug endpoint - DELETE after testing
import { NextResponse } from "next/server";
import dotypos from "@/lib/dotypos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, unknown> = {};
  
  try {
    const cloudId = await dotypos.getCloudId();
    results.cloudId = cloudId;
    
    // Raw branches response
    try {
      const branches = await dotypos.apiRequest<unknown>(`/clouds/${cloudId}/branches`);
      results.branches = branches;
    } catch (e) {
      results.branchesError = e instanceof Error ? e.message : String(e);
    }
    
    // Raw products (first page, limit 3)
    try {
      const products = await dotypos.apiRequest<unknown>(
        `/clouds/${cloudId}/products`,
        { params: { page: 1, limit: 3, sort: "-id" } }
      );
      results.sampleProducts = products;
    } catch (e) {
      results.productsError = e instanceof Error ? e.message : String(e);
    }
    
    // Payment methods
    try {
      const pm = await dotypos.apiRequest<unknown>(`/clouds/${cloudId}/payment-methods`);
      results.paymentMethods = pm;
    } catch (e) {
      results.paymentMethodsError = e instanceof Error ? e.message : String(e);
    }

    // Branches via the helper
    try {
      const br = await dotypos.getBranches();
      results.branchesViaHelper = br;
    } catch (e) {
      results.branchesHelperError = e instanceof Error ? e.message : String(e);
    }

    return NextResponse.json(results);
  } catch (error) {
    results.topLevelError = error instanceof Error ? error.message : String(error);
    return NextResponse.json(results, { status: 500 });
  }
}
