// src/lib/dotypos.ts
// =================================================
// Dotypos API v2 Client - Professional Integration
// Documentation: https://docs.api.dotypos.com/
// API Version: 2026.10.0
// Last updated: 2026-03-10
// =================================================

import crypto from "crypto";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Configuration & Constants
   ============================================================ */

const DOTYPOS_API_BASE = "https://api.dotykacka.cz/v2";
const DOTYPOS_ADMIN_URL = "https://admin.dotykacka.cz";

// Environment variables
const CLIENT_ID = process.env.DOTYPOS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.DOTYPOS_CLIENT_SECRET || "";

// Payment method ID for online payments (get from POS config or Dotypos admin)
// This is REQUIRED for create-issue-pay action. The API only accepts numeric IDs,
// NOT payment method names like "Przelewy24".
const ONLINE_PAYMENT_METHOD_ID = process.env.DOTYPOS_PAYMENT_METHOD_ID
  ? parseInt(process.env.DOTYPOS_PAYMENT_METHOD_ID, 10)
  : undefined;

// Cache configuration
const TOKEN_CACHE_TTL_MS = 55 * 60 * 1000; // 55 minutes (access token expires in 60)

/* ============================================================
   Types & Interfaces
   ============================================================ */

export interface DotyposConfig {
  clientId: string;
  clientSecret: string;
  cloudId?: string;
  branchId?: string;
}

export interface DotyposTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  cloudId: string;
}

export interface DotyposProduct {
  id: number;
  externalId: string | null;
  name: string;
  subtitle: string | null;
  description: string | null;
  ean: string[];
  plu: string[];
  packageItem: number | null;
  categoryId: number;
  points: number;
  priceWithVat: number;
  priceWithoutVat: number;
  vatRate: number;
  currency: string;
  stockDeduct: boolean;
  stockOverdraft: string;
  unitId: number | null;
  sortOrder: number;
  deleted: boolean;
  display: boolean;
  hexColor: string | null;
  tags: string[];
  packaging: number;
  allergens: number[];
  features: number;
  onSale: boolean;
  discountPercent: number;
  discountPermitted: boolean;
  modifiedAt: string;
}

export interface DotyposCategory {
  id: number;
  externalId: string | null;
  name: string;
  sortOrder: number;
  hexColor: string | null;
  parentCategoryId: number | null;
  deleted: boolean;
  display: boolean;
  modifiedAt: string;
}

export interface DotyposBranch {
  id: number;
  name: string;
  cloudId: number;
  externalId: string | null;
  enabled: boolean;
  deleted: boolean;
  modifiedAt: string;
}

export interface DotyposOrderItem {
  id: number;                     // Product ID (_productId)
  qty: number;                    // Quantity (can be decimal)
  note?: string;                  // Item note (e.g., "bez cebuli")
  "manual-price"?: number;        // Override unit price
  "manual-points"?: number;       // Override points
  "discount-percent"?: number;    // Item discount (20 = 20%)
  "course-id"?: number | null;    // Course ID (since 1.237)
  "take-away"?: boolean;          // Item-level takeaway (since 1.237)
  tags?: string[];                // Item tags
  customizations?: DotyposItemCustomization[]; // Product customizations (1.234+)
}

export type DotyposPOSAction =
  | "order/hello"              // Health check (1.239.8+)
  | "order/create"             // Create order only
  | "order/create-issue"       // Create + issue receipt
  | "order/create-issue-pay"   // Create + issue + mark paid
  | "order/update"             // Update existing order
  | "order/add-item"           // Add items to existing order
  | "order/issue"              // Issue receipt for existing order
  | "order/pay"                // Pay issued order
  | "order/issue-and-pay"      // Issue + pay existing order
  | "order/cancel"             // Cancel order (1.243+)
  | "order/list"               // List open orders (1.235+)
  | "order/split"              // Split order (1.234)
  | "order/split-issue"        // Split + issue (1.234)
  | "order/split-issue-pay"    // Split + issue + pay (1.234)
  | "order/set-item-takeaway"  // Set item takeaway (1.237+)
  | "order/change-item-course" // Change item course (1.237+)
  | "order/prepare-next-course" // Prepare next course (1.237+)
  | "order/perform-status-transition"; // Change order status (1.234+)

export interface DotyposItemCustomization {
  "product-customization-id": number;
  "product-id": number;
  "manual-price"?: number;      // Since Dotypos 2.9
  qty?: number;                  // Since Dotypos 2.17 (April 2026)
  "take-away"?: boolean;         // Since Dotypos 1.237
}

export interface DotyposPOSActionRequest {
  action: DotyposPOSAction;
  "external-id"?: string;
  "take-away"?: boolean;
  "table-id"?: number;
  "order-id"?: number;
  "user-id"?: number;
  "customer-id"?: number;
  "payment-method-id"?: number;
  /** @deprecated payment-method-name does NOT exist in POS Actions API. Use payment-method-id instead. */
  "payment-method-name"?: string;
  "discount-percent"?: number;
  "print-type"?: "local" | "remote" | "email" | "none";
  "print-email"?: string;
  "print-append"?: string;
  "print-config"?: Record<string, unknown>;
  webhook?: string;
  validity?: number;              // Unix timestamp - request expiry
  "idempotency-key"?: string;     // Dedup key (since Dotypos 2.1)
  lock?: boolean;                 // Lock order for 45s (1.234+)
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    note?: string;
  };
  items?: DotyposOrderItem[];
  note?: string;
}

export interface DotyposPOSPassThroughError {
  code: number;
  description: string;
  "localized-description"?: string;
}

export interface DotyposPOSActionResponse {
  order?: {
    id: number;
    "external-id"?: string;
    "price-total": number;
    currency: string;
    paid: boolean;
    status?: string;
    note?: string;
    "order-number"?: string;
    created: number;
    completed?: number;
    "locked-until"?: number;
    "customer-id"?: number;
    "user-id"?: number;
    "table-id"?: number;
  };
  items?: Array<{
    id: number;
    "product-id": number;
    name: string;
    qty: number;
    "price-with-vat": { unit: number; total: number; "unit-billed": number };
    "price-without-vat": { unit: number; total: number; "unit-billed": number };
    vat: number;
    "take-away": boolean;
    "course-id"?: number;
    customizations?: unknown[];
  }>;
  print?: string[];             // Base64 receipt data
  "print-png"?: string | null;  // Base64 receipt image (SK, 1.242+)
  code: number;                 // Result code (0 = OK)
  "pass-through-errors"?: DotyposPOSPassThroughError[]; // (1.242+)
  deviceTimestamp?: number;     // Device UTC timestamp in ms (1.239.8+)
  // Legacy compat fields (mapped from order)
  orderId?: number;
  receiptId?: number;
  status?: "ok" | "error";
  message?: string;
}

export interface DotyposPOSHelloResponse {
  device: string;
  timezone: string;
  "version:": {
    id: string;
    code: number;
    name: string;
  };
  code: number;
  deviceTimestamp: number;
}

export interface DotyposError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/* ============================================================
   Token Cache (in-memory with Supabase persistence)
   ============================================================ */

interface CachedToken {
  accessToken: string;
  expiresAt: number; // timestamp
}

let tokenCache: CachedToken | null = null;

/* ============================================================
   Supabase Helper
   ============================================================ */

let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase;
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  
  _supabase = createClient(url, key, { auth: { persistSession: false } });
  return _supabase;
}

/* ============================================================
   Signature Generation for OAuth
   ============================================================ */

/**
 * Generate HMAC-SHA256 signature for Dotypos OAuth requests
 * Format: HMAC-SHA256(client_secret, timestamp)
 */
export function generateSignature(
  clientSecret: string, 
  timestamp: number
): string {
  return crypto
    .createHmac("sha256", clientSecret)
    .update(String(timestamp))
    .digest("hex");
}

/**
 * Generate OAuth connector URL for admin panel
 * NOTE: As of Jan 2026, the GET method is deprecated.
 * Use POST form submission to /client/connect/v2 instead.
 * This function returns both the URL and form data for POST submission.
 */
export function generateConnectorUrl(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}): { url: string; formData: Record<string, string> } {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(options.clientSecret, timestamp);
  const state = options.state || crypto.randomUUID();
  
  const formData = {
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: options.scope || "*",
    state,
    timestamp: String(timestamp),
    signature,
  };
  
  // URL is kept for backwards compat (still works as GET with query params)
  const params = new URLSearchParams(formData);
  const url = `${DOTYPOS_ADMIN_URL}/client/connect/v2?${params.toString()}`;
  
  return { url, formData };
}

/* ============================================================
   Token Management
   ============================================================ */

/**
 * Retrieve integration credentials from Supabase
 */
async function getStoredIntegration(): Promise<{
  refreshToken: string;
  cloudId: string;
  accessToken?: string;
  accessTokenExpiresAt?: string;
} | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from("integrations")
    .select("refresh_token, cloud_id, access_token, access_token_expires_at")
    .eq("id", "dotypos")
    .single();
  
  if (error || !data?.refresh_token) {
    return null;
  }
  
  return {
    refreshToken: data.refresh_token,
    cloudId: data.cloud_id,
    accessToken: data.access_token,
    accessTokenExpiresAt: data.access_token_expires_at,
  };
}

/**
 * Store/update access token in Supabase
 */
async function storeAccessToken(
  accessToken: string, 
  expiresAt: Date
): Promise<void> {
  const supabase = getSupabase();
  
  await supabase
    .from("integrations")
    .update({
      access_token: accessToken,
      access_token_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", "dotypos");
}

/**
 * Exchange refresh token for new access token
 * Uses API v2 signin endpoint (updated Jan 2026)
 * 
 * API: POST https://api.dotykacka.cz/v2/signin/token
 * Header: Authorization: User $refreshToken
 * Body: { "_cloudId": "cloudId" }
 * Response: { "accessToken": "eyJ..." }
 */
async function exchangeRefreshToken(
  refreshToken: string,
  cloudId?: string
): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  // Get cloud ID if not provided
  const resolvedCloudId = cloudId || await getStoredCloudId();
  
  const response = await fetch(`${DOTYPOS_API_BASE}/signin/token`, {
    method: "POST",
    headers: {
      "Authorization": `User ${refreshToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(
      resolvedCloudId ? { _cloudId: resolvedCloudId } : {}
    ),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Dotypos] Token exchange failed:", response.status, errorText);
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.accessToken || data.access_token,
    expiresIn: 3600, // Default 1 hour (not guaranteed per docs)
  };
}

/**
 * Get cloud ID from stored integration (without full getStoredIntegration)
 */
async function getStoredCloudId(): Promise<string | undefined> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("integrations")
      .select("cloud_id")
      .eq("id", "dotypos")
      .single();
    return data?.cloud_id || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Get valid access token (from cache or refresh)
 */
export async function getAccessToken(): Promise<string> {
  // 1. Check in-memory cache
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.accessToken;
  }
  
  // 2. Check stored integration
  const stored = await getStoredIntegration();
  if (!stored) {
    throw new Error("Dotypos integration not configured. Please connect via admin panel.");
  }
  
  // 3. Check if stored access token is still valid
  if (stored.accessToken && stored.accessTokenExpiresAt) {
    const expiresAt = new Date(stored.accessTokenExpiresAt).getTime();
    if (expiresAt > Date.now() + 60000) { // 1 minute buffer
      tokenCache = {
        accessToken: stored.accessToken,
        expiresAt,
      };
      return stored.accessToken;
    }
  }
  
  // 4. Refresh the token
  console.log("[Dotypos] Refreshing access token...");
  const { accessToken, expiresIn } = await exchangeRefreshToken(
    stored.refreshToken,
    stored.cloudId
  );
  
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  
  // Update cache
  tokenCache = {
    accessToken,
    expiresAt: expiresAt.getTime(),
  };
  
  // Persist to database
  await storeAccessToken(accessToken, expiresAt);
  
  console.log("[Dotypos] Access token refreshed successfully");
  return accessToken;
}

/**
 * Get Cloud ID from stored integration
 */
export async function getCloudId(): Promise<string> {
  const stored = await getStoredIntegration();
  if (!stored?.cloudId) {
    throw new Error("Dotypos Cloud ID not configured");
  }
  return stored.cloudId;
}

/* ============================================================
   API Request Helper
   ============================================================ */

interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown> | Record<string, unknown>[];
  params?: Record<string, string | number | boolean>;
}

/**
 * Make authenticated request to Dotypos API v2
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { method = "GET", body, params } = options;
  
  const accessToken = await getAccessToken();
  
  // Build URL with query params
  let url = `${DOTYPOS_API_BASE}${endpoint}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }
  
  const headers: HeadersInit = {
    "Authorization": `Bearer ${accessToken}`,
    "Accept": "application/json",
  };
  
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Dotypos] API error ${response.status}:`, errorText);
    
    // Try to parse error response
    try {
      const errorJson = JSON.parse(errorText);
      throw new DotyposApiError(
        errorJson.code || `HTTP_${response.status}`,
        errorJson.message || `API request failed: ${response.status}`,
        errorJson.details
      );
    } catch (e) {
      if (e instanceof DotyposApiError) throw e;
      throw new DotyposApiError(
        `HTTP_${response.status}`,
        `API request failed: ${response.status} - ${errorText.slice(0, 200)}`
      );
    }
  }
  
  // Handle empty responses
  const text = await response.text();
  if (!text) return {} as T;
  
  return JSON.parse(text) as T;
}

/* ============================================================
   Custom Error Class
   ============================================================ */

export class DotyposApiError extends Error {
  code: string;
  details?: Record<string, unknown>;
  
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "DotyposApiError";
    this.code = code;
    this.details = details;
  }
}

/* ============================================================
   Products API
   ============================================================ */

export interface GetProductsOptions {
  page?: number;
  limit?: number;
  sort?: string;
  filter?: string;
  includeDeleted?: boolean;
}

/**
 * Fetch all products from Dotypos
 */
export async function getProducts(
  options: GetProductsOptions = {}
): Promise<{ data: DotyposProduct[]; page: number; pageSize: number; total: number }> {
  const cloudId = await getCloudId();
  
  const params: Record<string, string | number | boolean> = {
    page: options.page || 1,
    limit: options.limit || 100,
  };
  
  if (options.sort) params.sort = options.sort;
  if (options.filter) params.filter = options.filter;
  if (options.includeDeleted) params.includeDeleted = true;
  
  return apiRequest(`/clouds/${cloudId}/products`, { params });
}

/**
 * Fetch all products (handles pagination automatically)
 */
export async function getAllProducts(): Promise<DotyposProduct[]> {
  const allProducts: DotyposProduct[] = [];
  let page = 1;
  const limit = 100;
  
  while (true) {
    const response = await getProducts({ page, limit });
    allProducts.push(...response.data);
    
    if (response.data.length < limit || allProducts.length >= response.total) {
      break;
    }
    
    page++;
  }
  
  return allProducts;
}

/**
 * Fetch single product by ID
 */
export async function getProduct(productId: number): Promise<DotyposProduct> {
  const cloudId = await getCloudId();
  return apiRequest(`/clouds/${cloudId}/products/${productId}`);
}

/* ============================================================
   Categories API
   ============================================================ */

/**
 * Fetch all categories from Dotypos
 */
export async function getCategories(): Promise<{ data: DotyposCategory[] }> {
  const cloudId = await getCloudId();
  return apiRequest(`/clouds/${cloudId}/categories`);
}

/* ============================================================
   Branches API
   ============================================================ */

/**
 * Fetch all branches for the cloud
 */
export async function getBranches(): Promise<{ data: DotyposBranch[] }> {
  const cloudId = await getCloudId();
  return apiRequest(`/clouds/${cloudId}/branches`);
}

/**
 * Get configured branch ID from environment or first active branch
 */
export async function getBranchId(): Promise<number> {
  const envBranchId = process.env.DOTYPOS_BRANCH_ID;
  if (envBranchId) {
    return parseInt(envBranchId, 10);
  }
  
  const { data: branches } = await getBranches();
  const activeBranch = branches.find(b => b.enabled && !b.deleted);
  
  if (!activeBranch) {
    throw new Error("No active branch found in Dotypos");
  }
  
  return activeBranch.id;
}

/* ============================================================
   POS Actions (Orders)
   ============================================================ */

/**
 * Execute POS action (create order, issue receipt, process payment)
 * 
 * Full list of actions:
 * - "order/hello": Health check / POS liveness (1.239.8+)
 * - "order/create": Create order only
 * - "order/create-issue": Create + issue receipt (not SK)
 * - "order/create-issue-pay": Create + issue + mark paid
 * - "order/update": Update existing order
 * - "order/add-item": Add items to order
 * - "order/issue": Issue receipt (not SK)
 * - "order/pay": Pay issued order (not SK)
 * - "order/issue-and-pay": Issue + pay
 * - "order/cancel": Cancel empty order (1.243+)
 * - "order/list": List open orders (1.235+)
 * - "order/split": Split order (1.234)
 * - "order/set-item-takeaway": Set takeaway per item (1.237+)
 * - "order/change-item-course": Change course (1.237+)
 * - "order/perform-status-transition": Change status (1.234+, WIP)
 * 
 * @see https://docs.api.dotypos.com/pos-actions/pos-actions/
 */
export async function executePOSAction(
  branchId: number,
  action: DotyposPOSActionRequest,
  options?: {
    webhookUrl?: string;
    validitySeconds?: number;
    idempotencyKey?: string;
  }
): Promise<DotyposPOSActionResponse> {
  const cloudId = await getCloudId();
  
  // Add idempotency key for reliable delivery
  if (options?.idempotencyKey) {
    action["idempotency-key"] = options.idempotencyKey;
  } else if (!action["idempotency-key"]) {
    // Auto-generate idempotency key for order mutations
    if (action.action !== "order/hello" && action.action !== "order/list") {
      action["idempotency-key"] = crypto.randomUUID();
    }
  }
  
  // Add webhook URL if provided
  if (options?.webhookUrl) {
    action.webhook = options.webhookUrl;
  }
  
  // Add validity timestamp (request expiry)
  if (options?.validitySeconds) {
    action.validity = Math.floor(Date.now() / 1000) + options.validitySeconds;
  }
  
  const response = await apiRequest<DotyposPOSActionResponse>(
    `/clouds/${cloudId}/branches/${branchId}/pos-actions`,
    {
      method: "POST",
      body: action as unknown as Record<string, unknown>,
    }
  );
  
  // Map new response format to legacy compat fields
  if (response.order && !response.orderId) {
    response.orderId = response.order.id;
    response.status = response.code === 0 ? "ok" : "error";
  }
  
  return response;
}

/**
 * Create and process a complete order (issue receipt + mark as paid)
 * This is the main function to use for online orders
 */
export async function createOrder(options: {
  externalId: string;
  items: DotyposOrderItem[];
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  note?: string;
  takeAway?: boolean;
  paymentMethodId?: number;        // Numeric ID from POS config (fallback: DOTYPOS_PAYMENT_METHOD_ID env)
  webhookUrl?: string;             // Webhook for async POS response (default: sync mode)
  printType?: "local" | "remote" | "email" | "none";
  printEmail?: string;
}): Promise<DotyposPOSActionResponse> {
  const branchId = await getBranchId();
  
  const action: DotyposPOSActionRequest = {
    action: "order/create-issue-pay",
    "external-id": options.externalId,
    "take-away": options.takeAway ?? true,
    items: options.items,
  };
  
  if (options.customer) {
    action.customer = {
      name: options.customer.name,
      phone: options.customer.phone,
      email: options.customer.email,
    };
  }
  
  if (options.note) {
    action.note = options.note;
  }
  
  // payment-method-id is the ONLY way to specify payment method in the API.
  // "payment-method-name" does NOT exist in the Dotypos POS Actions API
  // and would be silently ignored.
  const paymentId = options.paymentMethodId || ONLINE_PAYMENT_METHOD_ID;
  if (paymentId) {
    action["payment-method-id"] = paymentId;
  } else {
    console.warn(
      "[Dotypos] WARNING: No payment-method-id configured! " +
      "Set DOTYPOS_PAYMENT_METHOD_ID env var. " +
      "Without it, POS will use default payment method (likely cash)."
    );
  }
  
  // NOTE: payment-method-name is NOT a valid API field, removed.
  // The API only accepts payment-method-id (numeric).

  if (options.printType) {
    action["print-type"] = options.printType;
  }

  if (options.printEmail) {
    action["print-email"] = options.printEmail;
  }
  
  console.log("[Dotypos] Creating order:", JSON.stringify(action, null, 2));
  
  return executePOSAction(branchId, action, {
    idempotencyKey: options.externalId, // Use order UUID as idempotency key
    webhookUrl: options.webhookUrl,
    validitySeconds: 300, // 5 minute validity
  });
}

/**
 * Create order without payment (for COD or pay-at-pickup)
 */
export async function createUnpaidOrder(options: {
  externalId: string;
  items: DotyposOrderItem[];
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  note?: string;
  takeAway?: boolean;
  webhookUrl?: string;
}): Promise<DotyposPOSActionResponse> {
  const branchId = await getBranchId();
  
  const action: DotyposPOSActionRequest = {
    action: "order/create-issue",
    "external-id": options.externalId,
    "take-away": options.takeAway ?? true,
    items: options.items,
  };
  
  if (options.customer) {
    action.customer = {
      name: options.customer.name,
      phone: options.customer.phone,
      email: options.customer.email,
    };
  }
  
  if (options.note) {
    action.note = options.note;
  }
  
  console.log("[Dotypos] Creating unpaid order:", JSON.stringify(action, null, 2));
  
  return executePOSAction(branchId, action, {
    idempotencyKey: options.externalId,
    webhookUrl: options.webhookUrl,
    validitySeconds: 300,
  });
}

/**
 * Create order only (no receipt, no payment - manual handling in POS)
 */
export async function createDraftOrder(options: {
  externalId: string;
  items: DotyposOrderItem[];
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  note?: string;
  takeAway?: boolean;
  lock?: boolean;          // Lock order for 45s for external changes
  webhookUrl?: string;
}): Promise<DotyposPOSActionResponse> {
  const branchId = await getBranchId();
  
  const action: DotyposPOSActionRequest = {
    action: "order/create",
    "external-id": options.externalId,
    "take-away": options.takeAway ?? true,
    items: options.items,
    lock: options.lock,
  };
  
  if (options.customer) {
    action.customer = {
      name: options.customer.name,
      phone: options.customer.phone,
      email: options.customer.email,
    };
  }
  
  if (options.note) {
    action.note = options.note;
  }
  
  console.log("[Dotypos] Creating draft order:", JSON.stringify(action, null, 2));
  
  return executePOSAction(branchId, action, {
    idempotencyKey: options.externalId,
    webhookUrl: options.webhookUrl,
    validitySeconds: 300,
  });
}

/* ============================================================
   Orders API (Read-only)
   ============================================================ */

export interface DotyposOrder {
  id: number;
  externalId: string | null;
  branchId: number;
  cloudId: number;
  status: string;
  totalPriceWithVat: number;
  currency: string;
  createdAt: string;
  modifiedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
}

/**
 * Get orders with optional filters
 */
export async function getOrders(options: {
  page?: number;
  limit?: number;
  filter?: string;
} = {}): Promise<{ data: DotyposOrder[] }> {
  const cloudId = await getCloudId();
  
  const params: Record<string, string | number> = {
    page: options.page || 1,
    limit: options.limit || 50,
  };
  
  if (options.filter) {
    params.filter = options.filter;
  }
  
  return apiRequest(`/clouds/${cloudId}/orders`, { params });
}

/**
 * Get single order by ID
 */
export async function getOrder(orderId: number): Promise<DotyposOrder> {
  const cloudId = await getCloudId();
  return apiRequest(`/clouds/${cloudId}/orders/${orderId}`);
}

/* ============================================================
   POS Utility Actions
   ============================================================ */

/**
 * POS Hello - Health check / liveness check for POS device (1.239.8+)
 * Returns device info, timezone, version, and device timestamp
 */
export async function posHello(): Promise<DotyposPOSHelloResponse | null> {
  try {
    const branchId = await getBranchId();
    const action: DotyposPOSActionRequest = {
      action: "order/hello",
    };
    
    const response = await executePOSAction(branchId, action);
    return response as unknown as DotyposPOSHelloResponse;
  } catch (error) {
    console.error("[Dotypos] POS Hello failed:", error);
    return null;
  }
}

/**
 * Cancel an empty order on POS (1.243+)
 * Note: Order must have no items
 */
export async function cancelOrder(orderId: number): Promise<DotyposPOSActionResponse> {
  const branchId = await getBranchId();
  
  const action: DotyposPOSActionRequest = {
    action: "order/cancel",
    "order-id": orderId,
  };
  
  return executePOSAction(branchId, action);
}

/**
 * List all open orders on POS (1.235+)
 * @param tableId - Filter by table (optional, null for orders outside table)
 */
export async function listOpenOrders(tableId?: number | null): Promise<DotyposPOSActionResponse> {
  const branchId = await getBranchId();
  
  const action: DotyposPOSActionRequest = {
    action: "order/list",
    ...(tableId !== undefined ? { "table-id": tableId } : {}),
  } as DotyposPOSActionRequest;
  
  return executePOSAction(branchId, action);
}

/**
 * Pay an already issued order (for delayed payment scenarios)
 */
export async function payOrder(
  orderId: number,
  paymentMethodId: number
): Promise<DotyposPOSActionResponse> {
  const branchId = await getBranchId();
  
  const action: DotyposPOSActionRequest = {
    action: "order/pay",
    "order-id": orderId,
    "payment-method-id": paymentMethodId,
  };
  
  return executePOSAction(branchId, action);
}

/* ============================================================
   Webhooks API
   ============================================================ */

export interface DotyposWebhook {
  id: number;
  _cloudId: number;
  _warehouseId?: number;
  method: "POST" | "GET";
  url: string;
  payloadEntity: "STOCKLOG" | "POINTSLOG" | "PRODUCT" | "ORDERBEAN" | "RESERVATION";
  payloadVersion: "V1";
  versionDate?: string;
}

/**
 * Get all registered webhooks
 */
export async function getWebhooks(): Promise<DotyposWebhook[]> {
  const cloudId = await getCloudId();
  return apiRequest(`/clouds/${cloudId}/webhooks`);
}

/**
 * Register a new webhook for entity change notifications
 * Supported entities: STOCKLOG, POINTSLOG, PRODUCT, ORDERBEAN, RESERVATION
 */
export async function registerWebhook(webhook: {
  url: string;
  method?: "POST" | "GET";
  payloadEntity: "STOCKLOG" | "POINTSLOG" | "PRODUCT" | "ORDERBEAN" | "RESERVATION";
}): Promise<DotyposWebhook> {
  const cloudId = await getCloudId();
  
  return apiRequest(`/clouds/${cloudId}/webhooks`, {
    method: "POST",
    body: {
      url: webhook.url,
      method: webhook.method || "POST",
      payloadEntity: webhook.payloadEntity,
      payloadVersion: "V1",
    },
  });
}

/**
 * Delete a webhook by ID
 */
export async function deleteWebhook(webhookId: number): Promise<void> {
  const cloudId = await getCloudId();
  await apiRequest(`/clouds/${cloudId}/webhooks/${webhookId}`, {
    method: "DELETE",
  });
}

/* ============================================================
   Health Check / Connection Test
   ============================================================ */

/**
 * Test Dotypos connection by fetching branches
 */
export async function testConnection(): Promise<{
  connected: boolean;
  cloudId?: string;
  branches?: { id: number; name: string }[];
  posOnline?: boolean;
  posDevice?: string;
  error?: string;
}> {
  try {
    const cloudId = await getCloudId();
    const { data: branches } = await getBranches();
    
    // Also try POS hello to check if device is online
    let posOnline = false;
    let posDevice: string | undefined;
    try {
      const hello = await posHello();
      if (hello && hello.code === 0) {
        posOnline = true;
        posDevice = hello.device;
      }
    } catch {
      // POS might be offline - that's ok
    }
    
    return {
      connected: true,
      cloudId,
      branches: branches
        .filter(b => b.enabled && !b.deleted)
        .map(b => ({ id: b.id, name: b.name })),
      posOnline,
      posDevice,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/* ============================================================
   Export default client object
   ============================================================ */

const dotypos = {
  // Config
  generateConnectorUrl,
  generateSignature,
  
  // Auth
  getAccessToken,
  getCloudId,
  
  // API
  apiRequest,
  
  // Products
  getProducts,
  getAllProducts,
  getProduct,
  
  // Categories
  getCategories,
  
  // Branches
  getBranches,
  getBranchId,
  
  // Orders / POS Actions
  createOrder,
  createUnpaidOrder,
  createDraftOrder,
  executePOSAction,
  getOrders,
  getOrder,
  cancelOrder,
  listOpenOrders,
  payOrder,
  
  // POS Utils
  posHello,
  
  // Webhooks
  getWebhooks,
  registerWebhook,
  deleteWebhook,
  
  // Health Check
  testConnection,
};

export default dotypos;
