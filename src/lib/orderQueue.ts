import type { SupabaseClient } from "@supabase/supabase-js";
import { orderDispatchToken } from "./orderDispatchAuth";
import { signPayment } from "./orderLink";
import { fromGrosze, toGrosze } from "./orderPricing";
import { SavedPricingError } from "./savedOrderPricing";
import { confirmVerifiedP24 } from "./orderLifecycle";
import { findP24Payment, p24Registration, p24Site } from "./p24QueueGateway";
import { prepareOrderMail, sendQueuedOrderMail } from "./queuedOrderMail";
import { sendNewOrderPush } from "./pushServer";

export type OrderJob = {
  id: string;
  job_key: string;
  order_id: string;
  kind: "p24_register" | "p24_reconcile" | "pos" | "mail";
  event: string | null;
  payload: Parameters<typeof prepareOrderMail>[2] | null;
  prepared: Parameters<typeof sendQueuedOrderMail>[1] | null;
  created_at: string;
  attempts: number;
  lease_id: string;
  first_external_at: string | null;
};

type Outcome = { state: "pending" | "done" | "review"; code: string; delay?: number; notify?: { total: number; mode: string } };
const done = (code: string): Outcome => ({ state: "done", code });
const review = (code: string): Outcome => ({ state: "review", code });
const retry = (code: string, delay?: number): Outcome => ({ state: "pending", code, delay });
const HOUR = 60 * 60 * 1000;

async function prepare(db: SupabaseClient, job: OrderJob, payload: OrderJob["prepared"]) {
  const { data, error } = await db.rpc("sisi_prepare_order_job", { job_id: job.id, lease: job.lease_id, body: payload });
  if (error) throw new Error("queue_prepare_failed");
  return data === true;
}

async function deliverMail(db: SupabaseClient, job: OrderJob): Promise<Outcome> {
  if (!process.env.RESEND_API_KEY) return retry("resend_config");
  if (job.first_external_at && Date.now() - Date.parse(job.first_external_at) >= 23 * HOUR) {
    return review("mail_dedup_window_elapsed");
  }
  let payload = job.prepared;
  if (!job.first_external_at) {
    if (!job.payload || !job.event) return review("mail_snapshot_missing");
    payload = await prepareOrderMail(db, job.event, job.payload);
    if (!payload) return done("mail_no_recipient");
    if (!await prepare(db, job, payload)) return retry("lease_lost");
  }
  if (!payload) return review("mail_payload_missing");

  const result = await sendQueuedOrderMail(job.job_key, payload);
  if (result === "sent") return done("mail_sent");
  return result === "retry" ? retry("mail_provider_retry") : review("mail_provider_rejected");
}

export async function workOrderJob(db: SupabaseClient, job: OrderJob): Promise<Outcome> {
  if (job.kind === "mail") return deliverMail(db, job);

  const { data: order, error } = await db.from("orders")
    .select("id,created_at,status,payment_status,payment_method,total_price,selected_option,contact_email,name,p24_session_id,p24_token,pos_dispatch_started_at,dotypos_order_id,dotypos_status")
    .eq("id", job.order_id).maybeSingle();
  if (error) return retry("order_read_failed");
  if (!order) return done("order_missing");
  const amountGrosze = toGrosze(Number(order.total_price));

  if (job.kind === "pos") {
    if (order.status === "cancelled") return done("pos_cancelled");
    if (order.dotypos_status === "price_mismatch") return review("pos_price_mismatch");
    if (order.dotypos_status === "items_rejected") return review("pos_items_rejected");
    const notify = { total: fromGrosze(amountGrosze), mode: order.selected_option };
    if (order.dotypos_order_id && ["sent", "confirmed"].includes(order.dotypos_status)) return { ...done("pos_confirmed"), notify };
    if (order.pos_dispatch_started_at) {
      return Date.now() - Date.parse(order.pos_dispatch_started_at) > 20 * 60 * 1000
        ? review("pos_unconfirmed") : retry("pos_waiting_confirmation", 60);
    }

    const token = orderDispatchToken(job.order_id);
    if (!token) return retry("pos_config");
    const response = await fetch(`${p24Site()}/api/dotypos/send-order`, {
      method: "POST", headers: { "content-type": "application/json", "X-Order-Dispatch": token },
      body: JSON.stringify({ orderId: job.order_id }), redirect: "error", signal: AbortSignal.timeout(12000),
    });
    const result = await response.json().catch(() => null);
    if (response.ok && result?.success && result?.posRecorded === true) {
      return { ...done("pos_sent"), notify };
    }
    if (result?.code === "POS_PRICE_MISMATCH") return review("pos_price_mismatch");
    if (result?.code === "POS_ITEMS_REJECTED") return review("pos_items_rejected");
    if (result?.code === "POS_QUOTE_INVALID") return review("pos_quote_invalid");
    if (result?.code === "POS_MAPPING_INCOMPLETE") return retry("pos_mapping_incomplete");
    if ([401, 403].includes(response.status)) return retry("pos_authorization");
    return retry("pos_waiting_confirmation", 45);
  }

  if (order.payment_status === "paid") return done("p24_already_paid");
  if (!order.p24_session_id || order.payment_method !== "Online" || !Number.isSafeInteger(amountGrosze) || amountGrosze <= 0) {
    return review("p24_invalid_order");
  }

  if (job.kind === "p24_register" && !job.first_external_at) {
    if (order.p24_token) return done("p24_registered");
    if (order.status === "cancelled") return done("p24_cancelled");
    const register = p24Registration({
      id: order.id, session: order.p24_session_id, amount: amountGrosze,
      email: order.contact_email ?? "", name: order.name ?? "",
      returnToken: signPayment(order.id, Date.parse(order.created_at)),
    });
    if (!await prepare(db, job, null)) return retry("lease_lost");

    // If the request might have reached P24, the next worker only looks up
    // this session. It never sends a second registration.
    const token = await register();
    const { data, error } = await db.rpc("sisi_store_p24_token", { job_id: job.id, lease: job.lease_id, token });
    if (error || !data) return retry("p24_token_unstored");
    return done("p24_registered");
  }

  if (job.kind === "p24_register" && order.p24_token) return done("p24_registered");
  if (process.env.P24_REST_RECOVERY_ENABLED !== "true") {
    return review(job.kind === "p24_register" ? "p24_registration_unconfirmed" : "p24_callback_unconfirmed");
  }
  const result = await findP24Payment(order.p24_session_id, amountGrosze);
  if (result.state === "mismatch") return review("p24_payment_mismatch");
  if (result.state === "refunded") return review("p24_already_refunded_externally");
  if (result.state === "paid") {
    const { outcome } = await confirmVerifiedP24(db, {
      sessionId: order.p24_session_id, gatewayOrderId: result.gatewayOrderId, amountGrosze,
    });
    return outcome === "mismatch" ? review("p24_payment_mismatch") : done(outcome);
  }
  if (job.kind === "p24_register") return review("p24_registration_unconfirmed");
  return Date.now() - Date.parse(job.created_at) >= 7 * 24 * HOUR
    ? done("p24_no_payment_seen") : retry("p24_awaiting_payment", Math.min(3600, 60 * 2 ** Math.min(job.attempts, 6)));
}

export async function processOrderJob(db: SupabaseClient, key: string | null = null) {
  const { data: jobs, error } = await db.rpc("sisi_claim_order_job", { wanted_key: key });
  if (error) throw new Error("queue_claim_failed");
  const job = jobs?.[0] as OrderJob | undefined;
  if (!job) return false;

  let outcome: Outcome;
  try {
    outcome = await workOrderJob(db, job);
  } catch (error) {
    outcome = error instanceof SavedPricingError ? review("mail_quote_invalid") : retry(job.kind === "p24_register" && job.first_external_at ? "p24_lookup_retry" : `${job.kind}_failed`);
  }
  const limit = job.kind === "p24_reconcile" ? 240 : 12;
  if (outcome.state === "pending" && job.attempts >= limit) outcome = review(outcome.code);

  const { data: finished, error: finishError } = await db.rpc("sisi_finish_order_job", {
    job_id: job.id, lease: job.lease_id, result: outcome.state, code: outcome.code,
    delay_seconds: outcome.delay ?? Math.min(1800, 15 * 2 ** Math.min(job.attempts - 1, 7)),
  });
  if (finishError) throw new Error("queue_finish_failed");
  if (finished && outcome.notify) {
    try {
      await sendNewOrderPush({ orderId: job.order_id, totalPln: outcome.notify.total, selectedOption: outcome.notify.mode });
    } catch {
      console.warn("[order-queue] staff push failed");
    }
  }
  return true;
}
