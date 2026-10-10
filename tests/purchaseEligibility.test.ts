import assert from "node:assert/strict";
import test from "node:test";
import { isOrderEligibleForPurchaseEvent } from "../src/lib/purchaseEligibility";

test("blocks pending order", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "pending_payment",
    payments: [{ provider: "mercadopago", status: "approved", paymentId: "123" }],
  }), false);
});

test("blocks pending payment", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "paid",
    payments: [{ provider: "mercadopago", status: "pending", paymentId: "123" }],
  }), false);
});

test("blocks rejected payment", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "paid",
    payments: [{ provider: "mercadopago", status: "rejected", paymentId: "123" }],
  }), false);
});

test("blocks cancelled order", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "cancelled",
    payments: [{ provider: "mercadopago", status: "approved", paymentId: "123" }],
  }), false);
});

test("blocks refunded order", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "refunded",
    payments: [{ provider: "mercadopago", status: "approved", paymentId: "123" }],
  }), false);
});

test("blocks processed refund before purchase event", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "paid",
    payments: [{ provider: "mercadopago", status: "approved", paymentId: "123" }],
    refunds: [{ status: "processed" }],
  }), false);
});

test("allows paid order with approved Mercado Pago payment and provider id", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "paid",
    payments: [{ provider: "mercadopago", status: "approved", paymentId: "123" }],
  }), true);
});

test("blocks historical paid order without payment evidence", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "paid",
    payments: [],
  }), false);
});

test("blocks Mercado Pago approved payment without provider payment id", () => {
  assert.equal(isOrderEligibleForPurchaseEvent({
    status: "paid",
    payments: [{ provider: "mercadopago", status: "approved", paymentId: null }],
  }), false);
});

test("uses event id policy shared by Pixel and CAPI", async () => {
  const { buildMetaPurchaseEventId } = await import("../src/lib/meta/purchase");
  assert.equal(buildMetaPurchaseEventId("order_123"), "purchase_order_123");
});
