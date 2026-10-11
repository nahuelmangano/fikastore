import { isOrderEligibleForPurchaseEvent, type PurchaseEligibilityInput } from "@/lib/purchaseEligibility";

export type OrderEmailEvent = "created-pending" | "payment-approved";
export type OrderEmailAudience = "buyer" | "merchant";

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
