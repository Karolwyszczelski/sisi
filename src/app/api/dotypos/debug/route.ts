// src/app/api/dotypos/debug/route.ts
// Temporary debug endpoint - DELETE after testing
import { NextResponse } from "next/server";
import dotypos from "@/lib/dotypos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cloudId = await dotypos.getCloudId();
    
    // Raw branches response
    const branches = await dotypos.apiRequest<unknown>(`/clouds/${cloudId}/branches`);
    
    // Raw products (first page, limit 5)
    const products = await dotypos.apiRequest<unknown>(
      `/clouds/${cloudId}/products`,
      { params: { page: 1, limit: 5, sort: "-id" } }
    );
    
    // Payment methods
    let paymentMethods: unknown = null;
    try {
      paymentMethods = await dotypos.apiRequest<unknown>(`/clouds/${cloudId}/payment-methods`);
    } catch (e) {
      paymentMethods = { error: String(e) };
    }
    
    return NextResponse.json({
      cloudId,
      branches,
      sampleProducts: products,
      paymentMethods,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
