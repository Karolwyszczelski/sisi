export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const getSupabaseAdmin = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase environment variables");
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

let _supabaseAdmin: ReturnType<typeof getSupabaseAdmin> | null = null;
const supabaseAdmin = new Proxy({} as ReturnType<typeof getSupabaseAdmin>, {
  get(_, prop) {
    if (!_supabaseAdmin) _supabaseAdmin = getSupabaseAdmin();
    return (_supabaseAdmin as any)[prop];
  },
});

type DiscountCode = {
  id: string;
  code: string;
  type: "amount" | "percent";
  value: number;
  active: boolean;
  auto_apply: boolean;
  starts_at: string | null;
  expires_at: string | null;
  min_order: number | null;
  max_uses: number | null;
  per_user_max_uses: number | null;
};

function computeDiscount(base: number, dc: DiscountCode): number {
  const raw = dc.type === "percent" ? base * (dc.value / 100) : dc.value;
  const clamped = Math.min(Math.max(0, raw), base);
  return Math.round(clamped * 100) / 100;
}

async function getUsageCounts(
  codeId: string,
  userId: string | null,
  emailLower: string | null
) {
  const [allQ, userQ, emailLowerQ, emailPlainQ] = await Promise.all([
    supabaseAdmin
      .from("discount_redemptions")
      .select("*", { head: true, count: "exact" })
      .eq("code_id", codeId),
    userId
      ? supabaseAdmin
          .from("discount_redemptions")
          .select("*", { head: true, count: "exact" })
          .eq("code_id", codeId)
          .eq("user_id", userId)
      : Promise.resolve({ count: 0 }),
    emailLower
      ? supabaseAdmin
          .from("discount_redemptions")
          .select("*", { head: true, count: "exact" })
          .eq("code_id", codeId)
          .eq("email_lower", emailLower)
      : Promise.resolve({ count: 0 }),
    emailLower
      ? supabaseAdmin
          .from("discount_redemptions")
          .select("*", { head: true, count: "exact" })
          .eq("code_id", codeId)
          .eq("email", emailLower)
      : Promise.resolve({ count: 0 }),
  ]);

  return {
    all: Number((allQ as any).count || 0),
    byUser: Number((userQ as any).count || 0),
    byEmail:
      Number((emailLowerQ as any).count || 0) +
      Number((emailPlainQ as any).count || 0),
  };
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {}

  const total = Number(body.total || 0);
  const userId: string | null = body.userId ? String(body.userId) : null;
  const emailLower: string | null = body.email
    ? String(body.email).toLowerCase()
    : null;

  if (!Number.isFinite(total) || total <= 0) {
    return NextResponse.json({ hasAuto: false });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("discount_codes")
    .select(
      "id, code, type, value, active, auto_apply, starts_at, expires_at, min_order, max_uses, per_user_max_uses"
    )
    .eq("active", true)
    .eq("auto_apply", true);

  if (error || !data || !data.length) {
    return NextResponse.json({ hasAuto: false });
  }

  let best: { dc: DiscountCode; amount: number } | null = null;

  for (const row of data as any[]) {
    const dc: DiscountCode = {
      id: String(row.id),
      code: String(row.code),
      type: row.type === "amount" ? "amount" : "percent",
      value: Number(row.value || 0),
      active: !!row.active,
      auto_apply: !!row.auto_apply,
      starts_at: row.starts_at ? String(row.starts_at) : null,
      expires_at: row.expires_at ? String(row.expires_at) : null,
      min_order: row.min_order == null ? null : Number(row.min_order),
      max_uses: row.max_uses == null ? null : Number(row.max_uses),
      per_user_max_uses:
        row.per_user_max_uses == null
          ? null
          : Number(row.per_user_max_uses),
    };

    if (!dc.value || dc.value <= 0) continue;
    if (dc.starts_at && dc.starts_at > nowIso) continue;
    if (dc.expires_at && dc.expires_at < nowIso) continue;
    if (dc.min_order != null && total < Number(dc.min_order)) continue;

    const { all, byUser, byEmail } = await getUsageCounts(
      dc.id,
      userId,
      emailLower
    );

    if (dc.max_uses != null && all >= Number(dc.max_uses)) continue;

    // null = brak limitu na użytkownika (nieograniczone użycie)
    const perUserLimit =
      dc.per_user_max_uses == null ? Infinity : Number(dc.per_user_max_uses);

    if (userId && byUser >= perUserLimit) continue;
    if (emailLower && byEmail >= perUserLimit) continue;

    const amount = computeDiscount(total, dc);
    if (amount <= 0) continue;

    if (!best || amount > best.amount) {
      best = { dc, amount };
    }
  }

  if (!best) {
    return NextResponse.json({ hasAuto: false });
  }

  return NextResponse.json({
    hasAuto: true,
    code: best.dc.code,
    type: best.dc.type,
    value: best.dc.value,
    amount: best.amount,
  });
}
