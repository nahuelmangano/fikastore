import assert from "node:assert/strict";
import test from "node:test";
import { isPaidOrderEmailEligible, orderEmailIdempotencyKey } from "@/lib/orderEmailNotificationPolicy";
import { transferInstructionsWithBankDetails } from "@/lib/manualPaymentInstructions";
import { sanitizeEmailError } from "@/lib/emailNotificationService";

test("order email keys are stable by order, event, and logical recipient", () => {
  const buyer = orderEmailIdempotencyKey("order-1", "payment-approved", "buyer");
  assert.equal(buyer, orderEmailIdempotencyKey("order-1", "payment-approved", "buyer"));
  assert.notEqual(buyer, orderEmailIdempotencyKey("order-1", "payment-approved", "merchant"));
  assert.notEqual(buyer, orderEmailIdempotencyKey("order-1", "created-pending", "buyer"));
  assert.notEqual(buyer, orderEmailIdempotencyKey("order-2", "payment-approved", "buyer"));
});

test("paid emails require a paid order and an approved corresponding payment", () => {
  assert.equal(isPaidOrderEmailEligible({
    status: "paid",
    payments: [{ provider: "transfer", status: "approved" }],
  }), true);
  for (const status of ["pending_payment", "cancelled", "refunded"]) {
    assert.equal(isPaidOrderEmailEligible({ status, payments: [{ provider: "transfer", status: "approved" }] }), false);
  }
  for (const paymentStatus of ["pending", "rejected", "cancelled"]) {
    assert.equal(isPaidOrderEmailEligible({ status: "paid", payments: [{ provider: "transfer", status: paymentStatus }] }), false);
  }
  assert.equal(isPaidOrderEmailEligible({
    status: "paid",
    payments: [{ provider: "mercadopago", status: "approved", paymentId: "mp-1" }],
    refunds: [{ status: "processed" }],
  }), false);
});

test("transfer instructions use only the configured bank values", () => {
  const result = transferInstructionsWithBankDetails("Enviar comprobante", {
    accountNumber: "",
    cbu: "configured-cbu",
    alias: "configured-alias",
    holder: "Configured Holder",
    taxId: "configured-tax-id",
    accountType: "Savings",
    bank: "Configured Bank",
  });
  assert.match(result, /configured-cbu/);
  assert.match(result, /configured-alias/);
  assert.match(result, /Configured Bank/);
  assert.doesNotMatch(result, /FIKAPIJAMAS|5025-566703/);
});

test("missing transfer details never invent bank coordinates", () => {
  assert.equal(transferInstructionsWithBankDetails("Enviar comprobante"), "Enviar comprobante");
});

test("mail error persistence removes OAuth credentials and bearer tokens", () => {
  const safe = sanitizeEmailError(new Error(
    'access_token=access-secret refresh_token:refresh-secret client_secret="client-secret" Bearer bearer-secret',
  ));
  assert.doesNotMatch(safe, /access-secret|refresh-secret|client-secret|bearer-secret/);
  assert.match(safe, /\[redacted\]/);
});
