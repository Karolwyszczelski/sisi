// src/app/api/dotypos/connector-url/route.ts
// =============================================
// Generate Dotypos OAuth Connector URL
// =============================================
//
// This endpoint generates a secure connector URL with HMAC-SHA256 signature.
// It keeps the client_secret server-side for security.
//
// Usage: GET /api/dotypos/connector-url
// Returns: { url: "https://admin.dotykacka.cz/client/connect/v2?..." }
// =============================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.DOTYPOS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DOTYPOS_CLIENT_SECRET || "";

/**
 * Generate HMAC-SHA256 signature
 */
function generateSignature(secret: string, timestamp: number): string {
  return crypto
    .createHmac("sha256", secret)
    .update(String(timestamp))
    .digest("hex");
}

export async function GET(req: NextRequest) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Dotypos credentials not configured" },
      { status: 500 }
    );
  }
  
  // Get origin for redirect URI
  const origin = req.headers.get("origin") || 
                 req.headers.get("referer")?.replace(/\/[^/]*$/, "") ||
                 process.env.NEXT_PUBLIC_APP_URL ||
                 "https://sisiciechanow.pl";
  
  const redirectUri = `${origin}/api/dotypos/callback`;
  const state = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(CLIENT_SECRET, timestamp);
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "*",
    state,
    timestamp: String(timestamp),
    signature,
  });
  
  const url = `https://admin.dotykacka.cz/client/connect/v2?${params.toString()}`;
  
  return NextResponse.json({ 
    url,
    expiresIn: 300, // URL valid for ~5 minutes due to timestamp
  });
}
