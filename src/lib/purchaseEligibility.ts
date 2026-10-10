export const PURCHASE_ELIGIBLE_ORDER_STATUSES = new Set(["paid", "shipped", "delivered"]);
export const PURCHASE_INCOMPATIBLE_ORDER_STATUSES = new Set(["pending_payment", "cancelled", "refunded"]);

export type PurchaseEligibilityInput = {
  status?: string | null;
  payments?: Array<{
    provider?: string | null;
    status?: string | null;
    paymentId?: string | null;
  }> | null;
  refunds?: Array<{
    status?: string | null;
  }> | null;
};

export function isOrderEligibleForPurchaseEvent(order: PurchaseEligibilityInput) {
  const orderStatus = String(order.status || "").toLowerCase();
  if (!PURCHASE_ELIGIBLE_ORDER_STATUSES.has(orderStatus)) return false;
  if (PURCHASE_INCOMPATIBLE_ORDER_STATUSES.has(orderStatus)) return false;

  const hasProcessedRefund = (order.refunds || []).some(
    (refund) => String(refund.status || "").toLowerCase() === "processed",
  );
  if (hasProcessedRefund) return false;

  return (order.payments || []).some((payment) => {
    const provider = String(payment.provider || "").toLowerCase();
    const status = String(payment.status || "").toLowerCase();
    if (status !== "approved") return false;
    if (provider === "mercadopago") return Boolean(String(payment.paymentId || "").trim());
    return true;
  });
}
