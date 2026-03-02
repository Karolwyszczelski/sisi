// src/lib/dotypos.ts
// =================================================
// Dotypos API v2 Client - Professional Integration
// Documentation: https://help.dotykacka.cz/cs/api2
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
  id: number;            // Product ID
  qty: number;           // Quantity (can be decimal)
  note?: string;         // Item note (e.g., "bez cebuli")
  unitPriceWithVat?: number; // Override unit price if needed
}

export interface DotyposPOSActionRequest {
  action: "order/create" | "order/create-issue" | "order/create-issue-pay";
  "external-id"?: string;
  "take-away"?: boolean;
  "table-seat"?: string;
  "payment-method-id"?: number;
  "payment-method-name"?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    note?: string;
  };
  items: DotyposOrderItem[];
  note?: string;
}

export interface DotyposPOSActionResponse {
  orderId?: number;
  receiptId?: number;
  status: "ok" | "error";
  message?: string;
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
 */
export function generateConnectorUrl(options: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope?: string;
  state?: string;
}): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = generateSignature(options.clientSecret, timestamp);
  
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    scope: options.scope || "*",
    state: options.state || crypto.randomUUID(),
    timestamp: String(timestamp),
    signature,
  });
  
  return `${DOTYPOS_ADMIN_URL}/client/connect/v2?${params.toString()}`;
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
 * Uses API v2 signin endpoint
 */
async function exchangeRefreshToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error("Missing DOTYPOS_CLIENT_ID or DOTYPOS_CLIENT_SECRET");
  }
  
  const response = await fetch(`${DOTYPOS_API_BASE}/signin/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Dotypos] Token exchange failed:", response.status, errorText);
    throw new Error(`Token exchange failed: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in || 3600, // default 1 hour
  };
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
  const { accessToken, expiresIn } = await exchangeRefreshToken(stored.refreshToken);
  
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
 * Actions:
 * - "order/create": Create order only (manual completion in POS)
 * - "order/create-issue": Create order and issue receipt
 * - "order/create-issue-pay": Create order, issue receipt, mark as paid
 */
export async function executePOSAction(
  branchId: number,
  action: DotyposPOSActionRequest
): Promise<DotyposPOSActionResponse> {
  const cloudId = await getCloudId();
  
  return apiRequest(`/clouds/${cloudId}/branches/${branchId}/pos-actions`, {
    method: "POST",
    body: action as unknown as Record<string, unknown>,
  });
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
  paymentMethodName?: string; // e.g., "Przelewy24", "Online", "Karta"
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
  
  if (options.paymentMethodName) {
    action["payment-method-name"] = options.paymentMethodName;
  }
  
  console.log("[Dotypos] Creating order:", JSON.stringify(action, null, 2));
  
  return executePOSAction(branchId, action);
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
  
  return executePOSAction(branchId, action);
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
   Health Check / Connection Test
   ============================================================ */

/**
 * Test Dotypos connection by fetching branches
 */
export async function testConnection(): Promise<{
  connected: boolean;
  cloudId?: string;
  branches?: { id: number; name: string }[];
  error?: string;
}> {
  try {
    const cloudId = await getCloudId();
    const { data: branches } = await getBranches();
    
    return {
      connected: true,
      cloudId,
      branches: branches
        .filter(b => b.enabled && !b.deleted)
        .map(b => ({ id: b.id, name: b.name })),
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
  executePOSAction,
  getOrders,
  getOrder,
  
  // Utils
  testConnection,
};

export default dotypos;
