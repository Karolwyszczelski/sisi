// src/types/dotypos.ts
// =============================================
// TypeScript Types for Dotypos API v2 Integration
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
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
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
  | "order/create"           // Create order only
  | "order/create-issue"     // Create + issue receipt
  | "order/create-issue-pay" // Create + issue + mark paid
  | "order/cancel"           // Cancel order
  | "receipt/issue"          // Issue receipt for existing order
  | "receipt/cancel";        // Cancel receipt

export interface DotyposOrderItem {
  id: number;                    // Product ID
  qty: number;                   // Quantity (can be decimal for weighted items)
  note?: string;                 // Item-level note
  unitPriceWithVat?: number;     // Override price (optional)
  discountPercent?: number;      // Item discount
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
  "table-seat"?: string;
  "payment-method-id"?: number;
  "payment-method-name"?: string;
  customer?: DotyposCustomer;
  items: DotyposOrderItem[];
  note?: string;
  discount?: {
    percent?: number;
    value?: number;
  };
}

export interface DotyposPOSActionResponse {
  status: "ok" | "error" | "partial";
  orderId?: number;
  receiptId?: number;
  message?: string;
  errors?: Array<{
    itemId?: number;
    code: string;
    message: string;
  }>;
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

export interface DotyposWebhookPayload {
  event: DotyposWebhookEvent;
  cloudId: number;
  branchId?: number;
  data: Record<string, unknown>;
  timestamp: string;
  signature: string;
}

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
