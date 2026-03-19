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
  
  // Form data for POST submission (recommended since Jan 2026)
  const formData = {
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "*",
    state,
    timestamp: String(timestamp),
    signature,
  };

  // Check if request wants JSON (API call) or HTML (direct browser redirect)
  const wantsJson = req.headers.get("accept")?.includes("application/json") ||
                    req.headers.get("x-requested-with") === "fetch";
  
  if (wantsJson) {
    return NextResponse.json({ 
      action: DOTYPOS_CONNECTOR_URL,
      method: "POST",
      formData,
      url: `${DOTYPOS_CONNECTOR_URL}?${new URLSearchParams(formData).toString()}`,
      expiresIn: 300,
    });
  }
  
  // Return auto-submitting HTML form (most reliable POST method)
  const inputs = Object.entries(formData)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
    .join("\n      ");
  
  const html = `<!DOCTYPE html>
<html>
  <head><title>Łączenie z Dotypos...</title></head>
  <body>
    <p>Przekierowanie do Dotypos...</p>
    <form id="dotypos-form" method="POST" action="${DOTYPOS_CONNECTOR_URL}">
      ${inputs}
    </form>
    <script>document.getElementById("dotypos-form").submit();</script>
  </body>
</html>`;
  
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
