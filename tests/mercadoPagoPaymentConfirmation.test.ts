import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeMercadoPagoStatus,
  validateMercadoPagoEvidence,
} from "../src/lib/mercadoPagoPaymentConfirmation";

const localOrder = { id: "order_123", total: "200.00" };

function checkoutApiOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: "ORD01",
    external_reference: "order_123",
    currency_id: "ARS",
    status: "processed",
    status_detail: "accredited",
    total_amount: "200.00",
    total_paid_amount: "200.00",
    user_id: "seller_1",
    transactions: {
      payments: [
        {
          id: "PAY01",
          status: "processed",
          status_detail: "accredited",
          amount: "200.00",
          paid_amount: "200.00",
        },
      ],
    },
    ...overrides,
  };
}

function checkoutProPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "123456789",
    external_reference: "order_123",
    currency_id: "ARS",
    status: "approved",
    transaction_amount: 200,
    collector_id: "seller_1",
    ...overrides,
  };
}

test("normalizes Orders API processed/accredited as approved", () => {
  assert.equal(normalizeMercadoPagoStatus("processed", "accredited"), "approved");
});

test("accepts verified Checkout Transparente approved evidence", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_api_order", order: checkoutApiOrder(), expectedConnectedUserId: "seller_1" },
    localOrder,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "approved");
  assert.equal(result.orderId, "order_123");
  assert.equal(result.paymentId, "PAY01");
});

test("accepts Orders API currency field from create/get responses", () => {
  const order = checkoutApiOrder({ currency_id: undefined, currency: "ARS" });
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_api_order", order, expectedConnectedUserId: "seller_1" },
    localOrder,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "approved");
});

test("keeps Checkout Transparente pending as pending without approval", () => {
  const result = validateMercadoPagoEvidence(
    {
      flow: "checkout_api_order",
      order: checkoutApiOrder({
        status: "action_required",
        status_detail: "",
        total_paid_amount: "0.00",
        transactions: { payments: [{ id: "PAY01", status: "action_required", amount: "200.00" }] },
      }),
    },
    localOrder,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "pending");
});

test("rejects Checkout Transparente order mismatch", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_api_order", order: checkoutApiOrder({ external_reference: "other_order" }) },
    localOrder,
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "order_mismatch");
});

test("rejects Checkout Transparente amount mismatch", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_api_order", order: checkoutApiOrder({ total_amount: "199.99" }) },
    localOrder,
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "amount_mismatch");
});

test("rejects Checkout Transparente currency mismatch", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_api_order", order: checkoutApiOrder({ currency_id: "USD" }) },
    localOrder,
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "currency_mismatch");
});

test("rejects Checkout Transparente seller mismatch", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_api_order", order: checkoutApiOrder({ user_id: "seller_2" }), expectedConnectedUserId: "seller_1" },
    localOrder,
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "seller_mismatch");
});

test("accepts verified Checkout Pro approved payment", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_pro_payment", payment: checkoutProPayment(), expectedConnectedUserId: "seller_1" },
    localOrder,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "approved");
  assert.equal(result.orderId, "order_123");
  assert.equal(result.paymentId, "123456789");
});

test("keeps Checkout Pro pending payment as pending", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_pro_payment", payment: checkoutProPayment({ status: "pending" }) },
    localOrder,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "pending");
});

test("rejects ambiguous Checkout Pro payment without external_reference", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_pro_payment", payment: checkoutProPayment({ external_reference: "" }) },
    localOrder,
  );

  assert.equal(result.ok, false);
  assert.equal(result.reason, "order_mismatch");
});

test("preserves rejected payment as rejected without approval", () => {
  const result = validateMercadoPagoEvidence(
    { flow: "checkout_pro_payment", payment: checkoutProPayment({ status: "rejected" }) },
    localOrder,
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "rejected");
});
