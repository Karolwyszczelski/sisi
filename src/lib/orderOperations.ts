import { sendNewOrderPush } from "@/lib/pushServer";

type DispatchOrderInput = {
  orderId: string;
  totalPln?: number | null;
  selectedOption?: string | null;
  appUrl?: string | null;
  logPrefix?: string;
  waitForDotypos?: boolean;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export function isOnlinePaymentPending(paymentMethod?: string | null, paymentStatus?: string | null) {
  return paymentMethod === "Online" && paymentStatus !== "paid";
}

function resolveAppUrl(appUrl?: string | null) {
  const raw =
    appUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";

  return raw ? trimTrailingSlash(raw) : "";
}

export async function dispatchOrderToOperations({
  orderId,
  totalPln,
  selectedOption,
  appUrl,
  logPrefix = "[order-operations]",
  waitForDotypos = false,
}: DispatchOrderInput) {
  try {
    await sendNewOrderPush({
      orderId,
      totalPln: typeof totalPln === "number" ? totalPln : undefined,
      selectedOption: selectedOption ?? undefined,
    });
  } catch (pushErr) {
    console.error(`${logPrefix} push error:`, pushErr);
  }

  const baseUrl = resolveAppUrl(appUrl);
  if (!baseUrl) {
    console.error(`${logPrefix} Dotypos dispatch skipped: missing app URL`);
    return;
  }

  const sendToDotypos = async () => {
    try {
      const res = await fetch(`${baseUrl}/api/dotypos/send-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        console.log(`${logPrefix} Dotypos POS send OK:`, data?.dotypos?.status || "sent");
      } else if (res.ok && !data?.success) {
        console.error(
          `${logPrefix} Dotypos POS rejected (code ${data?.dotypos?.code}):`,
          data?.dotypos?.status
        );
      } else {
        console.error(
          `${logPrefix} Dotypos POS send failed (${res.status}):`,
          JSON.stringify(data).slice(0, 300)
        );
      }
    } catch (err) {
      console.error(`${logPrefix} Dotypos POS send error:`, err instanceof Error ? err.message : err);
    }
  };

  if (waitForDotypos) {
    await sendToDotypos();
  } else {
    void sendToDotypos();
  }
}
