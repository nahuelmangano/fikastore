import type { Prisma } from "@prisma/client";
import { markOrderPaidIfPending } from "@/lib/orderPaymentTransition";

export type MercadoPagoFinancialEvidence =
  | {
      flow: "checkout_api_order";
      order: Record<string, unknown>;
      expectedConnectedUserId?: string | null;
    }
  | {
      flow: "checkout_pro_payment";
      payment: Record<string, unknown>;
      expectedConnectedUserId?: string | null;
    };

export type MercadoPagoConfirmationResult = {
  ok: boolean;
  status: string;
  orderId: string | null;
  paymentId: string | null;
  reason?: string;
  orderPaidChanged?: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function stringValue(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function numberValue(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameMoney(left: unknown, right: unknown) {
  const a = numberValue(left);
  const b = numberValue(right);
  if (a === null || b === null) return false;
  return Math.round(a * 100) === Math.round(b * 100);
}

export function normalizeMercadoPagoStatus(status: unknown, statusDetail?: unknown) {
  const s = stringValue(status).toLowerCase();
  const detail = stringValue(statusDetail).toLowerCase();

  if (
    s === "approved" ||
    s === "accredited" ||
    (s === "processed" && detail === "accredited")
  ) {
    return "approved";
  }
  if (s === "rejected" || s === "failed") return "rejected";
  if (s === "cancelled" || s === "canceled") return "cancelled";
  if (s === "refunded" || s === "charged_back") return "refunded";
  if (
    s === "pending" ||
    s === "in_process" ||
    s === "processing" ||
    s === "authorized" ||
    s === "action_required"
  ) {
    return "pending";
  }
  return "unknown";
}

function getOrdersApiPayments(order: Record<string, unknown>) {
  const transactions = asRecord(order.transactions);
  const payments = transactions?.payments;
  return Array.isArray(payments)
    ? payments.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)))
    : [];
}

function getOrdersApiPaymentId(payment: Record<string, unknown>, order: Record<string, unknown>) {
  return stringValue(payment.id) || stringValue(order.id) || null;
}

function sellerMatches(actualSellerId: unknown, expectedConnectedUserId?: string | null) {
  const expected = stringValue(expectedConnectedUserId);
  if (!expected) return true;
  const actual = stringValue(actualSellerId);
  if (!actual) return true;
  return actual === expected;
}

function currencyMatches(currencyId: unknown) {
  return stringValue(currencyId).toUpperCase() === "ARS";
}

export function validateMercadoPagoEvidence(
  evidence: MercadoPagoFinancialEvidence,
  order: {
    id: string;
    total: unknown;
  },
) {
  if (evidence.flow === "checkout_api_order") {
    const mpOrder = evidence.order;
    const payments = getOrdersApiPayments(mpOrder);
    const payment = payments[0] ?? {};
    const status = normalizeMercadoPagoStatus(payment.status ?? mpOrder.status, payment.status_detail ?? mpOrder.status_detail);
    const orderId = stringValue(mpOrder.external_reference);
    const paymentId = getOrdersApiPaymentId(payment, mpOrder);

    if (!orderId || orderId !== order.id) return { ok: false, status, orderId: orderId || null, paymentId, reason: "order_mismatch" };
    if (!currencyMatches(mpOrder.currency_id ?? mpOrder.currency)) return { ok: false, status, orderId, paymentId, reason: "currency_mismatch" };
    if (!sellerMatches(mpOrder.user_id, evidence.expectedConnectedUserId)) return { ok: false, status, orderId, paymentId, reason: "seller_mismatch" };
    if (!sameMoney(mpOrder.total_amount, order.total)) return { ok: false, status, orderId, paymentId, reason: "amount_mismatch" };

    if (status !== "approved") return { ok: true, status, orderId, paymentId };

    if (!sameMoney(mpOrder.total_paid_amount, order.total)) {
      return { ok: false, status, orderId, paymentId, reason: "paid_amount_mismatch" };
    }
    if (!sameMoney(payment.amount ?? payment.paid_amount, order.total)) {
      return { ok: false, status, orderId, paymentId, reason: "payment_amount_mismatch" };
    }

    return { ok: true, status, orderId, paymentId };
  }

  const payment = evidence.payment;
  const status = normalizeMercadoPagoStatus(payment.status, payment.status_detail);
  const orderId = stringValue(payment.external_reference);
  const paymentId = stringValue(payment.id) || null;

  if (!orderId || orderId !== order.id) return { ok: false, status, orderId: orderId || null, paymentId, reason: "order_mismatch" };
  if (!currencyMatches(payment.currency_id)) return { ok: false, status, orderId, paymentId, reason: "currency_mismatch" };
  if (!sellerMatches(payment.collector_id, evidence.expectedConnectedUserId)) return { ok: false, status, orderId, paymentId, reason: "seller_mismatch" };
  if (!sameMoney(payment.transaction_amount, order.total)) return { ok: false, status, orderId, paymentId, reason: "amount_mismatch" };

  return { ok: true, status, orderId, paymentId };
}

export function sanitizeMercadoPagoRawJson(value: unknown) {
  return JSON.stringify(value).slice(0, 4000);
}

export async function reconcileMercadoPagoFinancialConfirmation(
  tx: Prisma.TransactionClient,
  evidence: MercadoPagoFinancialEvidence,
  options?: {
    fallbackOrderId?: string;
    fallbackPaymentRowId?: string;
  },
): Promise<MercadoPagoConfirmationResult> {
  const fallbackOrderId = stringValue(options?.fallbackOrderId);
  const expectedOrderId =
    evidence.flow === "checkout_api_order"
      ? stringValue(evidence.order.external_reference) || fallbackOrderId
      : stringValue(evidence.payment.external_reference) || fallbackOrderId;

  if (!expectedOrderId) {
    return { ok: false, status: "unknown", orderId: null, paymentId: null, reason: "missing_order_reference" };
  }

  const order = await tx.order.findUnique({
    where: { id: expectedOrderId },
    select: { id: true, total: true },
  });

  if (!order) {
    return { ok: false, status: "unknown", orderId: expectedOrderId, paymentId: null, reason: "order_not_found" };
  }

  const validation = validateMercadoPagoEvidence(evidence, order);
  if (!validation.ok) {
    return { ...validation, ok: false };
  }

  const status = validation.status;
  const paymentId = validation.paymentId;
  const paymentPayload = evidence.flow === "checkout_api_order" ? evidence.order : evidence.payment;
  const mpOrderId = evidence.flow === "checkout_api_order" ? stringValue(evidence.order.id) : "";
  const ordersApiPayment =
    evidence.flow === "checkout_api_order" ? getOrdersApiPayments(evidence.order)[0] : null;

  const existingByPaymentId = paymentId
    ? await tx.payment.findFirst({ where: { provider: "mercadopago", paymentId } })
    : null;
  const existingByMpOrderId = !existingByPaymentId && mpOrderId
    ? await tx.payment.findFirst({ where: { provider: "mercadopago", mpOrderId } })
    : null;
  const existingByFallback = !existingByPaymentId && !existingByMpOrderId && options?.fallbackPaymentRowId
    ? await tx.payment.findUnique({ where: { id: options.fallbackPaymentRowId } })
    : null;
  const existingByOpenOrderAttempt = !existingByPaymentId && !existingByMpOrderId && !existingByFallback && evidence.flow === "checkout_api_order"
    ? await tx.payment.findFirst({
        where: {
          orderId: order.id,
          provider: "mercadopago",
          paymentId: null,
          status: { in: ["pending", "unknown"] },
          mpRequestStatus: { in: ["processing", "unknown"] },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const existing = existingByPaymentId || existingByMpOrderId || existingByFallback || existingByOpenOrderAttempt;

  if (existing && existing.orderId !== order.id) {
    return { ok: false, status, orderId: order.id, paymentId, reason: "payment_order_mismatch" };
  }

  if (existing) {
    await tx.payment.update({
      where: { id: existing.id },
      data: {
        status,
        paymentId,
        preferenceId:
          evidence.flow === "checkout_api_order"
            ? stringValue(ordersApiPayment?.preference_id) || existing.preferenceId
            : stringValue(evidence.payment.preference_id) || existing.preferenceId,
        rawJson: sanitizeMercadoPagoRawJson(paymentPayload),
        mpOrderId: mpOrderId || existing.mpOrderId,
        mpRequestStatus: evidence.flow === "checkout_api_order" ? "completed" : existing.mpRequestStatus,
        mpRequestFinishedAt: evidence.flow === "checkout_api_order" ? new Date() : existing.mpRequestFinishedAt,
        pendingAt: status === "pending" ? existing.pendingAt ?? new Date() : existing.pendingAt,
      },
    });
  } else {
    await tx.payment.create({
      data: {
        orderId: order.id,
        provider: "mercadopago",
        status,
        paymentId,
        preferenceId:
          evidence.flow === "checkout_api_order"
            ? stringValue(ordersApiPayment?.preference_id) || undefined
            : stringValue(evidence.payment.preference_id) || undefined,
        rawJson: sanitizeMercadoPagoRawJson(paymentPayload),
        mpOrderId: mpOrderId || undefined,
        mpRequestStatus: evidence.flow === "checkout_api_order" ? "completed" : undefined,
        mpRequestFinishedAt: evidence.flow === "checkout_api_order" ? new Date() : undefined,
        pendingAt: status === "pending" ? new Date() : undefined,
      },
    });
  }

  let orderPaidChanged = false;
  if (status === "approved") {
    const transition = await markOrderPaidIfPending(tx, order.id);
    orderPaidChanged = transition.changed;
  }

  return { ok: true, status, orderId: order.id, paymentId, orderPaidChanged };
}
