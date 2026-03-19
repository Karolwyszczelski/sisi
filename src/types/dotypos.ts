// src/types/dotypos.ts
// =============================================
// TypeScript Types for Dotypos API v2 Integration
// API Version: 2026.10.0
// Documentation: https://docs.api.dotypos.com/
// Last updated: 2026-03-10
// =============================================

/* ============================================================
   Configuration
   ============================================================ */

export interface DotyposConfig {
  clientId: string;
  clientSecret: string;
  cloudId?: string;
  branchId?: number;
  redirectUri?: string;
}

/* ============================================================
   Authentication
   ============================================================ */

export interface DotyposTokenResponse {
  /** New 2026 format uses 'accessToken' (camelCase) */
  accessToken?: string;
  /** Legacy format (may still appear) */
  access_token?: string;
  token_type?: "Bearer";
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

export interface DotyposOAuthParams {
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string;
  timestamp: number;
  signature: string;
}

export interface DotyposCallbackParams {
  token: string;     // refresh_token
  cloudid: string;   // cloud_id
  state?: string;
  error?: string;
}

/* ============================================================
   API Response Wrappers
   ============================================================ */

export interface DotyposListResponse<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DotyposErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/* ============================================================
   Products
   ============================================================ */

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
  stockOverdraft: "allowed" | "not_allowed";
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

export interface DotyposProductCreate {
  name: string;
  externalId?: string;
  subtitle?: string;
  description?: string;
  ean?: string[];
  plu?: string[];
  categoryId: number;
  priceWithVat: number;
  vatRate?: number;
  currency?: string;
  sortOrder?: number;
  display?: boolean;
  hexColor?: string;
  tags?: string[];
  allergens?: number[];
}

/* ============================================================
   Categories
   ============================================================ */

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

/* ============================================================
   Branches
   ============================================================ */

export interface DotyposBranch {
  id: number;
  name: string;
  cloudId: number;
  externalId: string | null;
  enabled: boolean;
  deleted: boolean;
  address?: DotyposAddress;
  openingHours?: DotyposOpeningHours[];
  modifiedAt: string;
}

export interface DotyposAddress {
  street?: string;
  city?: string;
  zip?: string;
  country?: string;
  lat?: number;
  lng?: number;
}

export interface DotyposOpeningHours {
  dayOfWeek: number; // 1-7 (Monday-Sunday)
  openTime: string;  // HH:MM
  closeTime: string; // HH:MM
}

/* ============================================================
   POS Actions (Orders)
   ============================================================ */

export type DotyposPOSActionType = 
  | "order/hello"                   // Health check (1.239.8+)
  | "order/create"                  // Create order only
  | "order/create-issue"            // Create + issue receipt
  | "order/create-issue-pay"        // Create + issue + mark paid
  | "order/update"                  // Update existing order (1.234+)
  | "order/add-item"                // Add items to order (1.234+)
  | "order/issue"                   // Issue receipt for order
  | "order/pay"                     // Pay issued order
  | "order/issue-and-pay"           // Issue + pay
  | "order/cancel"                  // Cancel empty order (1.243+)
  | "order/list"                    // List open orders (1.235+)
  | "order/split"                   // Split order (1.234)
  | "order/split-issue"             // Split + issue (1.234)
  | "order/split-issue-pay"         // Split + issue + pay (1.234)
  | "order/set-item-takeaway"       // Set item takeaway (1.237+)
  | "order/change-item-course"      // Change course (1.237+)
  | "order/prepare-next-course"     // Prepare next course (1.237+)
  | "order/perform-status-transition" // Change status (1.234+)
  | "receipt/issue"                 // Issue receipt (legacy compat)
  | "receipt/cancel";               // Cancel receipt (legacy compat)

export interface DotyposOrderItem {
  id: number;                    // Product ID (_productId)
  qty: number;                   // Quantity (can be decimal for weighted items)
  note?: string;                 // Item-level note
  "manual-price"?: number;       // Override unit price (since Dotypos 2.9)
  "discount-percent"?: number;   // Item discount percentage
  "course-id"?: number | null;   // Course ID (since 1.237)
  "take-away"?: boolean;         // Item-level takeaway (since 1.237)
  tags?: string[];               // Item tags
  customizations?: DotyposItemCustomization[]; // Customizations (1.234+)
  /** @deprecated Use "manual-price" instead */
  unitPriceWithVat?: number;
  /** @deprecated Use "discount-percent" instead */
  discountPercent?: number;
}

export interface DotyposItemCustomization {
  "product-customization-id": number;  // ID of customization definition
  "product-id": number;                // Customization product ID
  "manual-price"?: number;             // Override price (since Dotypos 2.9)
  qty?: number;                         // Quantity (since Dotypos 2.17, April 2026)
  "take-away"?: boolean;               // Item-level takeaway (since 1.237)
}

export interface DotyposCustomer {
  name?: string;
  phone?: string;
  email?: string;
  note?: string;
  loyaltyCardNumber?: string;
}

export interface DotyposPOSActionRequest {
  action: DotyposPOSActionType;
  "external-id"?: string;
  "take-away"?: boolean;
  "table-id"?: number;
  "order-id"?: number;               // For actions on existing orders
  "user-id"?: number;                // Employee/user ID
  "customer-id"?: number;            // Customer ID
  "payment-method-id"?: number;
  "payment-method-name"?: string;
  "discount-percent"?: number;       // Order-level discount
  "print-type"?: "local" | "remote" | "email" | "none";
  "print-email"?: string;
  "print-append"?: string;           // Extra text on receipt
  "print-config"?: Record<string, unknown>;
  webhook?: string;                   // Webhook URL for response
  validity?: number;                  // Unix timestamp - request expiry
  "idempotency-key"?: string;         // Dedup key (since Dotypos 2.1)
  lock?: boolean;                     // Lock order for 45s (1.234+)
  customer?: DotyposCustomer;
  items?: DotyposOrderItem[];
  note?: string;
  /** @deprecated Use "table-id" instead */
  "table-seat"?: string;
  /** @deprecated Use direct fields instead */
  discount?: {
    percent?: number;
    value?: number;
  };
}

export interface DotyposPOSPassThroughError {
  code: number;
  description: string;
  "localized-description"?: string;
}

export interface DotyposPOSActionResponse {
  code: number;                   // Result code (0 = OK)
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
  print?: string[];               // Base64 receipt data
  "print-png"?: string | null;    // Base64 receipt image (SK, 1.242+)
  "pass-through-errors"?: DotyposPOSPassThroughError[]; // (1.242+)
  deviceTimestamp?: number;       // Device UTC timestamp in ms (1.239.8+)
  // Legacy compat
  status?: "ok" | "error" | "partial";
  orderId?: number;
  receiptId?: number;
  message?: string;
  errors?: Array<{
    itemId?: number;
    code: string;
    message: string;
  }>;
}

/** Response from order/hello action (1.239.8+) */
export interface DotyposPOSHelloResponse {
  device: string;
  timezone: string;
  /** NOTE: The API literally returns "version:" with a trailing colon as the JSON key */
  "version:": {
    id: string;
    code: number;
    name: string;
  };
  code: number;
  deviceTimestamp: number;
}

/* ============================================================
   Orders (Read)
   ============================================================ */

export interface DotyposOrder {
  id: number;
  externalId: string | null;
  branchId: number;
  cloudId: number;
  employeeId: number | null;
  customerId: number | null;
  tableId: number | null;
  status: DotyposOrderStatus;
  totalPriceWithVat: number;
  totalPriceWithoutVat: number;
  currency: string;
  note: string | null;
  takeAway: boolean;
  createdAt: string;
  modifiedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  items?: DotyposOrderItemDetail[];
}

export type DotyposOrderStatus = 
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "paid";

export interface DotyposOrderItemDetail {
  id: number;
  productId: number;
  productName: string;
  quantity: number;
  unitPriceWithVat: number;
  totalPriceWithVat: number;
  note: string | null;
  cancelled: boolean;
}

/* ============================================================
   Receipts
   ============================================================ */

export interface DotyposReceipt {
  id: number;
  orderId: number;
  branchId: number;
  number: string;
  totalPriceWithVat: number;
  currency: string;
  paymentMethodId: number;
  paymentMethodName: string;
  issuedAt: string;
  cancelledAt: string | null;
}

/* ============================================================
   Payment Methods
   ============================================================ */

export interface DotyposPaymentMethod {
  id: number;
  name: string;
  type: "cash" | "card" | "online" | "voucher" | "other";
  enabled: boolean;
}

/* ============================================================
   Webhooks
   ============================================================ */

/** Registered webhook entity types (API v2) */
export type DotyposWebhookEntity = 
  | "STOCKLOG"     // Stock changes
  | "POINTSLOG"    // Points changes
  | "PRODUCT"      // Product changes
  | "ORDERBEAN"    // Order changes
  | "RESERVATION"; // Reservation changes

export interface DotyposWebhookRegistration {
  id: number;
  _cloudId: number;
  _warehouseId?: number;
  method: "POST" | "GET";
  url: string;
  payloadEntity: DotyposWebhookEntity;
  payloadVersion: "V1";
  versionDate?: string;
}

/** Webhook notification payload received from Dotypos */
export interface DotyposWebhookPayload {
  cloudId: number;
  branchId?: number;
  warehouseId?: number;
  entityId: number;              // ID of the changed entity
  entityType: DotyposWebhookEntity;
  action: "created" | "updated" | "deleted";
  timestamp: number;             // Unix timestamp
  data?: Record<string, unknown>;
}

/** POS Action webhook callback (response to webhook param in POS actions) */
export interface DotyposPOSActionWebhookPayload {
  order?: DotyposPOSActionResponse["order"];
  items?: DotyposPOSActionResponse["items"];
  code: number;
  deviceTimestamp?: number;
  "external-id"?: string;
}

/** @deprecated Use DotyposWebhookEntity instead */
export type DotyposWebhookEvent = 
  | "order.created"
  | "order.updated"
  | "order.completed"
  | "order.cancelled"
  | "receipt.issued"
  | "receipt.cancelled"
  | "product.created"
  | "product.updated"
  | "product.deleted";

/* ============================================================
   Local Database Types (Supabase)
   ============================================================ */

export interface POSProduct {
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

export interface POSCategory {
  pos_id: number;
  name: string;
  parent_id: number | null;
  sort_order: number;
  deleted: boolean;
  synced_at: string;
}

export interface IntegrationRecord {
  id: string;                        // "dotypos"
  refresh_token: string;
  cloud_id: string;
  access_token?: string;
  access_token_expires_at?: string;
  connected_at?: string;
  updated_at?: string;
}

/* ============================================================
   Order Extension (for orders table)
   ============================================================ */

export interface OrderDotyposExtension {
  dotypos_order_id?: number;
  dotypos_receipt_id?: number;
  dotypos_sent_at?: string;
  dotypos_error?: string;
}
