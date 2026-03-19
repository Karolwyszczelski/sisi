// src/app/api/dotypos/connector-url/route.ts
// =============================================
// Generate Dotypos OAuth Connector URL / Form Data
// =============================================
//
// This endpoint generates secure connector data for Dotypos OAuth v2.
// As of Jan 2026, the GET method is deprecated — use POST form submission.
// This returns both the URL (for backward compat) and form data for POST.
//
// Usage: GET /api/dotypos/connector-url
// Returns: { url, formData, action, method, expiresIn }
// =============================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.DOTYPOS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DOTYPOS_CLIENT_SECRET || "";
const DOTYPOS_CONNECTOR_URL = "https://admin.dotykacka.cz/client/connect/v2";

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
  
  // Redirect URI must be consistent - always use the canonical app URL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sisiciechanow.pl";
  const redirectUri = `${appUrl}/api/dotypos/callback`;
  const state = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(CLIENT_SECRET, timestamp);
  
  // Return form data for POST submission (Dotypos Connector v2, Jan 2026+)
  // The CLIENT creates a DOM form and submits it — this is the official
  // Dotypos-recommended approach (see docs.api.dotypos.com/authorization)
  return NextResponse.json({
    action: DOTYPOS_CONNECTOR_URL,
    method: "POST",
    formData: {
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      scope: "*",
      state,
      timestamp: String(timestamp),
      signature,
    },
    expiresIn: 300,
  });
}
