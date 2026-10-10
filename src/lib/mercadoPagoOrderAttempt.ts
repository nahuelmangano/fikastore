import { createHash, randomUUID } from "node:crypto";

export const MP_ORDER_REQUEST_STATUSES = {
  processing: "processing",
  unknown: "unknown",
  completed: "completed",
  failed: "failed",
} as const;

export type MercadoPagoOrderRequestStatus =
  (typeof MP_ORDER_REQUEST_STATUSES)[keyof typeof MP_ORDER_REQUEST_STATUSES];

export type ExistingMercadoPagoAttempt = {
  id: string;
  status: string;
  paymentAttemptId?: string | null;
  mpIdempotencyKey?: string | null;
  mpRequestHash?: string | null;
  mpRequestStatus?: string | null;
  mpOrderId?: string | null;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashMercadoPagoOrderPayload(payload: unknown) {
  return createHash("sha256").update(canonicalJson(payload)).digest("hex");
}

export function createMercadoPagoIdempotencyKey() {
  return randomUUID();
}

export function isBlockingMercadoPagoAttempt(payment: ExistingMercadoPagoAttempt) {
  const status = String(payment.status || "").toLowerCase();
  const requestStatus = String(payment.mpRequestStatus || "").toLowerCase();

  if (status === "approved") return true;
  if (status === "pending" && payment.mpIdempotencyKey) return true;
  if (status === "unknown" && payment.mpIdempotencyKey) return true;
  return requestStatus === MP_ORDER_REQUEST_STATUSES.processing || requestStatus === MP_ORDER_REQUEST_STATUSES.unknown;
}

export function assertMercadoPagoAttemptPayloadMatches(
  attempt: ExistingMercadoPagoAttempt,
  requestHash: string,
) {
  if (attempt.mpRequestHash && attempt.mpRequestHash !== requestHash) {
    throw new Error("mercadopago_attempt_payload_mismatch");
  }
}

export function shouldTreatMercadoPagoOrderErrorAsUnknown(status: number, code?: string | null) {
  if (status >= 500) return true;
  if (status === 423 || status === 429) return true;
  return code === "idempotency_validation_failed";
}
