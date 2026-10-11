import { isOrderEligibleForPurchaseEvent, type PurchaseEligibilityInput } from "@/lib/purchaseEligibility";

export type OrderEmailEvent = "created-pending" | "payment-approved";
export type OrderEmailAudience = "buyer" | "merchant";

const PURCHASE_EMAIL_TEMPLATES = [
  "payment-approved",
  "payment-pending",
  "payment-pending-reminder",
  "merchant-payment-approved",
  "merchant-order-created",
];

export function isPaidOrderEmailEligible(order: PurchaseEligibilityInput) {
  return isOrderEligibleForPurchaseEvent(order);
}

export function orderEmailIdempotencyKey(
  orderId: string,
  event: OrderEmailEvent,
  audience: OrderEmailAudience,
) {
  return `order-email:${orderId}:${event}:${audience}`;
}

export function shouldRetryEmailNotification(input: {
  orderId: string | null;
  templateKey: string;
  idempotencyKey: string;
}) {
  if (!input.orderId || !PURCHASE_EMAIL_TEMPLATES.includes(input.templateKey)) return true;
  return input.idempotencyKey.startsWith("order-email:");
}

export function isCurrentPaymentEmailJob(payload: Record<string, unknown>) {
  return payload.notificationVersion === 2;
}
