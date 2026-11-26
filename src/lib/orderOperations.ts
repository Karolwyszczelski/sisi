export function isOnlinePaymentPending(paymentMethod?: string | null, paymentStatus?: string | null) {
  return paymentMethod === "Online" && paymentStatus !== "paid";
}
