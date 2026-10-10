import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import {
  assertMercadoPagoAttemptPayloadMatches,
  createMercadoPagoIdempotencyKey,
  hashMercadoPagoOrderPayload,
  isBlockingMercadoPagoAttempt,
  MP_ORDER_REQUEST_STATUSES,
} from "../src/lib/mercadoPagoOrderAttempt";
import {
  reconcileMercadoPagoFinancialConfirmation,
  validateMercadoPagoEvidence,
} from "../src/lib/mercadoPagoPaymentConfirmation";
import { isOrderEligibleForPurchaseEvent } from "../src/lib/purchaseEligibility";
import { buildMetaPurchaseEventId, buildMetaPurchasePayload } from "../src/lib/meta/purchase";

const RUN_ID = `final-${Date.now()}`;
const SELLER_ID = "seller_123";

function assertIsolatedSqlServerDatabase() {
  const url = String(process.env.DATABASE_URL || "");
  assert.match(url, /sqlserver:\/\//, "DATABASE_URL must point to SQL Server");
  assert.match(
    url,
    /database=fikastore_final_validation_/,
    "DATABASE_URL must point to an isolated final validation database",
  );
}

async function createProduct() {
  return prisma.product.create({
    data: {
      name: `Validation Product ${RUN_ID}`,
      slug: `validation-product-${RUN_ID}-${Math.random().toString(36).slice(2)}`,
      description: "Integration validation product",
      price: 1000,
      stock: 10,
      isActive: true,
    },
  });
}

async function createOrder(total = 1000) {
  const product = await createProduct();
  return prisma.order.create({
    data: {
      contactEmail: `buyer-${RUN_ID}-${Math.random().toString(36).slice(2)}@example.test`,
      status: "pending_payment",
      total,
      shippingName: "Integration Buyer",
      shippingPhone: "1111111111",
      shippingAddressLine: "Test 123",
      shippingCity: "CABA",
      shippingZip: "1000",
      shippingProvince: "Buenos Aires",
      shippingProvinceCode: "BA",
      shippingAmount: 0,
      items: {
        create: {
          productId: product.id,
          nameSnapshot: product.name,
          unitPrice: total,
          quantity: 1,
          subtotal: total,
        },
      },
    },
    include: { items: true, payments: true, refunds: true },
  });
}

function mpOrder(overrides: Record<string, unknown> = {}) {
  const payment = {
    id: `pay_mock_approved_${RUN_ID}_${Math.random().toString(36).slice(2)}`,
    status: "approved",
    status_detail: "accredited",
    amount: "1000.00",
  };
  return {
    id: `ORD-${Math.random().toString(36).slice(2)}`,
    status: "processed",
    status_detail: "accredited",
    external_reference: "",
    currency: "ARS",
    total_amount: "1000.00",
    total_paid_amount: "1000.00",
    user_id: SELLER_ID,
    transactions: { payments: [payment] },
    ...overrides,
  };
}

async function reserveAttempt(input: {
  orderId: string;
  paymentAttemptId: string;
  requestHash: string;
}) {
  return prisma.$transaction(async (tx) => {
    const payments = await tx.payment.findMany({
      where: { orderId: input.orderId, provider: "mercadopago" },
      orderBy: { createdAt: "desc" },
    });

    const sameAttempt = payments.find((payment) => payment.paymentAttemptId === input.paymentAttemptId) ?? null;
    if (sameAttempt) {
      assertMercadoPagoAttemptPayloadMatches(sameAttempt, input.requestHash);
    }

    const blockingOtherAttempt = payments.find(
      (payment) => payment.paymentAttemptId !== input.paymentAttemptId && isBlockingMercadoPagoAttempt(payment),
    );
    if (blockingOtherAttempt) throw new Error("mercadopago_active_attempt");

    const reusableInitialPayment = payments.find(
      (payment) => !payment.paymentAttemptId && !payment.mpIdempotencyKey && payment.status === "pending",
    ) ?? null;
    const targetPayment = sameAttempt ?? reusableInitialPayment;

    if (targetPayment) {
      const idempotencyKey = targetPayment.mpIdempotencyKey || createMercadoPagoIdempotencyKey();
      return tx.payment.update({
        where: { id: targetPayment.id },
        data: {
          paymentAttemptId: input.paymentAttemptId,
          mpIdempotencyKey: idempotencyKey,
          mpRequestHash: input.requestHash,
          mpRequestStatus: targetPayment.mpOrderId
            ? targetPayment.mpRequestStatus
            : MP_ORDER_REQUEST_STATUSES.processing,
          mpRequestStartedAt: targetPayment.mpRequestStartedAt ?? new Date(),
          mpLastError: null,
        },
      });
    }

    return tx.payment.create({
      data: {
        orderId: input.orderId,
        provider: "mercadopago",
        status: "pending",
        paymentAttemptId: input.paymentAttemptId,
        mpIdempotencyKey: createMercadoPagoIdempotencyKey(),
        mpRequestHash: input.requestHash,
        mpRequestStatus: MP_ORDER_REQUEST_STATUSES.processing,
        mpRequestStartedAt: new Date(),
        pendingAt: new Date(),
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function loadEligibility(orderId: string) {
  return prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      status: true,
      payments: { select: { provider: true, status: true, paymentId: true } },
      refunds: { select: { status: true } },
    },
  });
}

test("final SQL Server validation for FIKA payments and purchases", async (t) => {
  assertIsolatedSqlServerDatabase();

  await t.test("migration columns and filtered unique indexes exist", async () => {
    const columns = await prisma.$queryRaw<Array<{ name: string; max_length: number }>>`
      SELECT name, max_length
      FROM sys.columns
      WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
        AND name IN (N'paymentAttemptId', N'mpIdempotencyKey', N'mpRequestHash', N'mpRequestStatus', N'mpOrderId', N'mpLastError')
    `;
    const byName = new Map(columns.map((column) => [column.name, column.max_length]));
    assert.equal(byName.get("paymentAttemptId"), 240);
    assert.equal(byName.get("mpIdempotencyKey"), 240);
    assert.equal(byName.get("mpRequestHash"), 128);
    assert.equal(byName.get("mpRequestStatus"), 40);
    assert.equal(byName.get("mpOrderId"), 240);
    assert.equal(byName.get("mpLastError"), -1);

    const indexes = await prisma.$queryRaw<Array<{ name: string; has_filter: boolean }>>`
      SELECT name, has_filter
      FROM sys.indexes
      WHERE object_id = OBJECT_ID(N'[dbo].[Payment]')
        AND name IN (
          N'Payment_orderId_paymentAttemptId_unique',
          N'Payment_mpIdempotencyKey_unique',
          N'Payment_mpOrderId_unique'
        )
    `;
    assert.equal(indexes.length, 3);
    assert.equal(indexes.every((index) => index.has_filter), true);
  });

  await t.test("approved Mercado Pago evidence marks Payment approved and Order paid", async () => {
    const order = await createOrder();
    const result = await prisma.$transaction((tx) =>
      reconcileMercadoPagoFinancialConfirmation(
        tx,
        {
          flow: "checkout_api_order",
          order: mpOrder({ external_reference: order.id }),
          expectedConnectedUserId: SELLER_ID,
        },
        { fallbackOrderId: order.id },
      )
    );

    assert.equal(result.ok, true);
    assert.equal(result.status, "approved");

    const updated = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { payments: true },
    });
    assert.equal(updated.status, "paid");
    assert.equal(updated.payments.length, 1);
    assert.equal(updated.payments[0].status, "approved");
  });

  await t.test("pending and rejected Mercado Pago evidence do not mark Order paid", async () => {
    const pendingOrder = await createOrder();
    await prisma.$transaction((tx) =>
      reconcileMercadoPagoFinancialConfirmation(
        tx,
        {
          flow: "checkout_api_order",
          order: mpOrder({
            external_reference: pendingOrder.id,
            status: "processing",
            status_detail: "pending_waiting_payment",
            total_paid_amount: "0.00",
            transactions: { payments: [{ id: `pay_mock_pending_${RUN_ID}`, status: "pending", amount: "1000.00" }] },
          }),
          expectedConnectedUserId: SELLER_ID,
        },
        { fallbackOrderId: pendingOrder.id },
      )
    );
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: pendingOrder.id } })).status, "pending_payment");

    const rejectedOrder = await createOrder();
    await prisma.$transaction((tx) =>
      reconcileMercadoPagoFinancialConfirmation(
        tx,
        {
          flow: "checkout_api_order",
          order: mpOrder({
            external_reference: rejectedOrder.id,
            status: "processed",
            status_detail: "rejected",
            total_paid_amount: "0.00",
            transactions: { payments: [{ id: `pay_mock_rejected_${RUN_ID}`, status: "rejected", amount: "1000.00" }] },
          }),
          expectedConnectedUserId: SELLER_ID,
        },
        { fallbackOrderId: rejectedOrder.id },
      )
    );
    assert.equal((await prisma.order.findUniqueOrThrow({ where: { id: rejectedOrder.id } })).status, "pending_payment");
  });

  await t.test("two simultaneous same-attempt reservations reuse one idempotency key", async () => {
    const order = await createOrder();
    const requestHash = hashMercadoPagoOrderPayload({ orderId: order.id, amount: 1000, token: "token-a" });
    const [left, right] = await Promise.all([
      reserveAttempt({ orderId: order.id, paymentAttemptId: "attempt_same", requestHash }),
      reserveAttempt({ orderId: order.id, paymentAttemptId: "attempt_same", requestHash }),
    ]);

    assert.equal(left.mpIdempotencyKey, right.mpIdempotencyKey);
    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    assert.equal(payments.length, 1);
  });

  await t.test("different attempt is blocked while previous attempt is unknown", async () => {
    const order = await createOrder();
    const first = await reserveAttempt({
      orderId: order.id,
      paymentAttemptId: "attempt_unknown",
      requestHash: hashMercadoPagoOrderPayload({ orderId: order.id, amount: 1000, token: "token-a" }),
    });
    await prisma.payment.update({
      where: { id: first.id },
      data: {
        status: "unknown",
        mpRequestStatus: MP_ORDER_REQUEST_STATUSES.unknown,
        mpLastError: "timeout before mpOrderId",
      },
    });

    await assert.rejects(
      () => reserveAttempt({
        orderId: order.id,
        paymentAttemptId: "attempt_new",
        requestHash: hashMercadoPagoOrderPayload({ orderId: order.id, amount: 1000, token: "token-b" }),
      }),
      /mercadopago_active_attempt/,
    );
  });

  await t.test("late webhook after timeout updates same Payment and duplicate webhooks are idempotent", async () => {
    const order = await createOrder();
    const reserved = await reserveAttempt({
      orderId: order.id,
      paymentAttemptId: "attempt_late_webhook",
      requestHash: hashMercadoPagoOrderPayload({ orderId: order.id, amount: 1000, token: "token-a" }),
    });
    await prisma.payment.update({
      where: { id: reserved.id },
      data: { status: "unknown", mpRequestStatus: MP_ORDER_REQUEST_STATUSES.unknown, mpLastError: "timeout" },
    });

    const evidence = mpOrder({
      id: `ORD-late-webhook-${RUN_ID}`,
      external_reference: order.id,
      transactions: { payments: [{ id: `pay_late_webhook_${RUN_ID}`, status: "approved", status_detail: "accredited", amount: "1000.00" }] },
    });

    for (let i = 0; i < 2; i += 1) {
      const result = await prisma.$transaction((tx) =>
        reconcileMercadoPagoFinancialConfirmation(
          tx,
          { flow: "checkout_api_order", order: evidence, expectedConnectedUserId: SELLER_ID },
          { fallbackOrderId: order.id },
        )
      );
      assert.equal(result.ok, true);
      assert.equal(result.status, "approved");
    }

    const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true } });
    assert.equal(updated.status, "paid");
    assert.equal(updated.payments.length, 1);
    assert.equal(updated.payments[0].id, reserved.id);
    assert.equal(updated.payments[0].paymentId, `pay_late_webhook_${RUN_ID}`);
    assert.equal(updated.payments[0].mpOrderId, `ORD-late-webhook-${RUN_ID}`);
  });

  await t.test("late response after webhook remains idempotent", async () => {
    const order = await createOrder();
    const reserved = await reserveAttempt({
      orderId: order.id,
      paymentAttemptId: "attempt_response_after_webhook",
      requestHash: hashMercadoPagoOrderPayload({ orderId: order.id, amount: 1000, token: "token-a" }),
    });
    const evidence = mpOrder({
      id: `ORD-response-after-webhook-${RUN_ID}`,
      external_reference: order.id,
      transactions: { payments: [{ id: `pay_response_after_webhook_${RUN_ID}`, status: "approved", status_detail: "accredited", amount: "1000.00" }] },
    });

    await prisma.$transaction((tx) =>
      reconcileMercadoPagoFinancialConfirmation(
        tx,
        { flow: "checkout_api_order", order: evidence, expectedConnectedUserId: SELLER_ID },
        { fallbackOrderId: order.id },
      )
    );
    await prisma.$transaction((tx) =>
      reconcileMercadoPagoFinancialConfirmation(
        tx,
        { flow: "checkout_api_order", order: evidence, expectedConnectedUserId: SELLER_ID },
        { fallbackOrderId: order.id, fallbackPaymentRowId: reserved.id },
      )
    );

    const payments = await prisma.payment.findMany({ where: { orderId: order.id } });
    assert.equal(payments.length, 1);
    assert.equal(payments[0].paymentId, `pay_response_after_webhook_${RUN_ID}`);
  });

  await t.test("same attempt with different payload is rejected before provider call", async () => {
    const order = await createOrder();
    await reserveAttempt({
      orderId: order.id,
      paymentAttemptId: "attempt_payload_mismatch",
      requestHash: hashMercadoPagoOrderPayload({ amount: 1000, token: "token-a" }),
    });

    await assert.rejects(
      () => reserveAttempt({
        orderId: order.id,
        paymentAttemptId: "attempt_payload_mismatch",
        requestHash: hashMercadoPagoOrderPayload({ amount: 1000, token: "token-b" }),
      }),
      /mercadopago_attempt_payload_mismatch/,
    );
  });

  await t.test("amount, currency, seller and reference mismatches are rejected", async () => {
    const order = await createOrder();
    const cases = [
      ["amount_mismatch", mpOrder({ external_reference: order.id, total_amount: "999.99" })],
      ["currency_mismatch", mpOrder({ external_reference: order.id, currency: "USD" })],
      ["seller_mismatch", mpOrder({ external_reference: order.id, user_id: "other_seller" })],
      ["order_mismatch", mpOrder({ external_reference: "other_order" })],
    ] as const;

    for (const [reason, evidence] of cases) {
      const result = validateMercadoPagoEvidence(
        { flow: "checkout_api_order", order: evidence, expectedConnectedUserId: SELLER_ID },
        { id: order.id, total: order.total },
      );
      assert.equal(result.ok, false);
      assert.equal(result.reason, reason);
    }
  });

  await t.test("purchase eligibility, Pixel/GA4/CAPI event policy only allow paid approved evidence", async () => {
    const order = await createOrder();
    await prisma.$transaction((tx) =>
      reconcileMercadoPagoFinancialConfirmation(
        tx,
        {
          flow: "checkout_api_order",
          order: mpOrder({
            external_reference: order.id,
            transactions: { payments: [{ id: `pay_purchase_ok_${RUN_ID}`, status: "approved", status_detail: "accredited", amount: "1000.00" }] },
          }),
          expectedConnectedUserId: SELLER_ID,
        },
        { fallbackOrderId: order.id },
      )
    );
    const eligible = await loadEligibility(order.id);
    assert.equal(isOrderEligibleForPurchaseEvent(eligible), true);
    assert.equal(buildMetaPurchaseEventId(order.id), `purchase_${order.id}`);
    assert.deepEqual(buildMetaPurchasePayload({ id: order.id, total: 1000, items: [{ id: "sku-1", quantity: 1, unitPrice: 1000 }] }), {
      content_type: "product",
      currency: "ARS",
      num_items: 1,
      order_id: order.id,
      value: 1000,
      content_ids: ["sku-1"],
      contents: [{ id: "sku-1", quantity: 1, item_price: 1000 }],
    });

    const pending = await createOrder();
    assert.equal(isOrderEligibleForPurchaseEvent(await loadEligibility(pending.id)), false);

    const historical = await createOrder();
    await prisma.order.update({ where: { id: historical.id }, data: { status: "paid", paidAt: new Date() } });
    assert.equal(isOrderEligibleForPurchaseEvent(await loadEligibility(historical.id)), false);

    const refunded = await createOrder();
    const payment = await prisma.payment.create({
      data: { orderId: refunded.id, provider: "mercadopago", status: "approved", paymentId: `pay_refunded_${RUN_ID}` },
    });
    await prisma.order.update({ where: { id: refunded.id }, data: { status: "paid", paidAt: new Date() } });
    await prisma.refund.create({
      data: {
        orderId: refunded.id,
        paymentId: payment.id,
        status: "processed",
        amount: 1000,
        type: "total",
      },
    });
    assert.equal(isOrderEligibleForPurchaseEvent(await loadEligibility(refunded.id)), false);
  });
});
