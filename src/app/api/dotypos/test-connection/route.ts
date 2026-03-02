// src/app/api/dotypos/test-connection/route.ts
// =============================================
// Test Dotypos Connection
// =============================================

import { NextResponse } from "next/server";
import dotypos from "@/lib/dotypos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await dotypos.testConnection();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Dotypos Test] Error:", error);
    
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
