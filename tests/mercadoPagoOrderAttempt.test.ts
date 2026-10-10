import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMercadoPagoAttemptPayloadMatches,
  hashMercadoPagoOrderPayload,
  isBlockingMercadoPagoAttempt,
  MP_ORDER_REQUEST_STATUSES,
  shouldTreatMercadoPagoOrderErrorAsUnknown,
} from "../src/lib/mercadoPagoOrderAttempt";

test("hashes equivalent payloads in stable key order", () => {
  const left = hashMercadoPagoOrderPayload({ b: 2, a: { d: 4, c: 3 } });
  const right = hashMercadoPagoOrderPayload({ a: { c: 3, d: 4 }, b: 2 });

  assert.equal(left, right);
});

test("rejects reusing same idempotency key with different payload", () => {
  assert.throws(
    () => assertMercadoPagoAttemptPayloadMatches({
      id: "payment_1",
      status: "pending",
      paymentAttemptId: "attempt_1",
      mpIdempotencyKey: "idem_1",
      mpRequestHash: "hash_a",
    }, "hash_b"),
    /mercadopago_attempt_payload_mismatch/,
  );
});

test("allows retrying same attempt with same payload hash", () => {
  assert.doesNotThrow(() => assertMercadoPagoAttemptPayloadMatches({
    id: "payment_1",
    status: "unknown",
    paymentAttemptId: "attempt_1",
    mpIdempotencyKey: "idem_1",
    mpRequestHash: "hash_a",
  }, "hash_a"));
});

test("blocks a new attempt while an existing attempt is pending with idempotency key", () => {
  assert.equal(isBlockingMercadoPagoAttempt({
    id: "payment_1",
    status: "pending",
    paymentAttemptId: "attempt_1",
    mpIdempotencyKey: "idem_1",
    mpRequestStatus: MP_ORDER_REQUEST_STATUSES.processing,
  }), true);
});

test("blocks a new attempt after an unknown timeout result", () => {
  assert.equal(isBlockingMercadoPagoAttempt({
    id: "payment_1",
    status: "unknown",
    paymentAttemptId: "attempt_1",
    mpIdempotencyKey: "idem_1",
    mpRequestStatus: MP_ORDER_REQUEST_STATUSES.unknown,
  }), true);
});

test("does not block a new legitimate attempt after rejected payment", () => {
  assert.equal(isBlockingMercadoPagoAttempt({
    id: "payment_1",
    status: "rejected",
    paymentAttemptId: "attempt_1",
    mpIdempotencyKey: "idem_1",
    mpRequestStatus: MP_ORDER_REQUEST_STATUSES.completed,
  }), false);
});

test("treats provider timeout-like statuses as unknown", () => {
  assert.equal(shouldTreatMercadoPagoOrderErrorAsUnknown(500), true);
  assert.equal(shouldTreatMercadoPagoOrderErrorAsUnknown(423), true);
  assert.equal(shouldTreatMercadoPagoOrderErrorAsUnknown(429), true);
  assert.equal(shouldTreatMercadoPagoOrderErrorAsUnknown(400), false);
});
