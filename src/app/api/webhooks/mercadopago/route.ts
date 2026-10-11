/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMercadoPagoOAuthPaymentContext, getResolvedMercadoPagoAccessToken } from "@/lib/storeSettings";
import { notifyBackInStock } from "@/lib/stockNotifications";
import { publicBaseUrl } from "@/lib/publicUrl";
import { cancelOrderPaymentEmailJobs, queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { emailOrderItemsHtml, emailOrderItemsText } from "@/lib/emailProductRows";
import { getOrderContactEmail } from "@/lib/orderAccess";
import { dispatchOrderEmailNotifications, enqueuePaidOrderEmailsInTransaction } from "@/lib/orderEmailNotifications";
import { syncMetaPurchaseForOrder } from "@/lib/meta/conversionsApi";
import {
  normalizeMercadoPagoStatus,
  reconcileMercadoPagoFinancialConfirmation,
} from "@/lib/mercadoPagoPaymentConfirmation";

type MpWebhookBody = any;

async function fetchPayment(paymentId: string) {
  const token = await getResolvedMercadoPagoAccessToken();
  if (!token) throw new Error("MP_ACCESS_TOKEN missing");

  const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`MP get payment failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchMerchantOrder(orderId: string) {
  const token = await getResolvedMercadoPagoAccessToken();
  if (!token) throw new Error("MP_ACCESS_TOKEN missing");

  const r = await fetch(`https://api.mercadopago.com/merchant_orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`MP get merchant_order failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchCheckoutApiOrder(orderId: string) {
  const token = await getResolvedMercadoPagoAccessToken();
  if (!token) throw new Error("MP_ACCESS_TOKEN missing");

  const r = await fetch(`https://api.mercadopago.com/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`MP get order failed: ${JSON.stringify(data)}`);
  }
  return data;
}

async function expectedConnectedUserId() {
  const context = await getMercadoPagoOAuthPaymentContext().catch(() => null);
  return context?.connectedUserId || null;
}

async function upsertPaymentAndUpdateOrder(payment: any, req?: Request) {
  const mpStatus = normalizeMercadoPagoStatus(payment.status, payment.status_detail);
  const isCardPaymentBrick = String(payment.metadata?.payment_flow || "").toLowerCase() === "card_payment_brick";
  const paymentId = String(payment.id);
  const orderId = typeof payment.external_reference === "string" ? payment.external_reference : "";

  if (!orderId) {
    throw new Error(`MP payment missing external_reference paymentId=${paymentId}`);
  }

  // Datos para notificar fuera de la transacción.
  let shouldSendRejectedEmail = false;
  let emailTo: string | null = null;
  let emailName = "";
  let orderTotal = 0;
  let orderNumber: number | undefined;
  let paymentRowId: string | undefined;
  const restoredProductIds = new Set<string>();
  let confirmationOk = false;
  let emailNotificationIds: string[] = [];
  const connectedUserId = await expectedConnectedUserId();

  await prisma.$transaction(async (tx) => {
    const confirmation = await reconcileMercadoPagoFinancialConfirmation(
      tx,
      {
        flow: "checkout_pro_payment",
        payment,
        expectedConnectedUserId: connectedUserId,
      },
      { fallbackOrderId: orderId },
    );

    if (!confirmation.ok) {
      throw new Error(`MP payment evidence rejected paymentId=${paymentId} orderId=${orderId} reason=${confirmation.reason} status=${confirmation.status}`);
    }

    confirmationOk = true;
    const currentPayment = await tx.payment.findFirst({
      where: { provider: "mercadopago", paymentId },
      select: { id: true },
    });
    paymentRowId = currentPayment?.id;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { email: true, name: true } } },
    });
    if (!order) return;

    if (mpStatus === "approved") {
      if (confirmation.status === "approved" && confirmation.orderPaidChanged) {
        emailNotificationIds = await enqueuePaidOrderEmailsInTransaction(tx, {
          orderId,
          paymentId: paymentRowId,
          payment,
          req,
        });
      }
      return;
    }

    if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded") {
      const orderEmail = getOrderContactEmail(order);
      if (mpStatus === "rejected" && orderEmail && !isCardPaymentBrick) {
        shouldSendRejectedEmail = true;
        emailTo = orderEmail;
        emailName = order.user?.name ?? order.shippingName ?? order.contactEmail ?? "";
        orderTotal = Number(order.total);
        orderNumber = order.orderNumber ?? undefined;
      }

      if (order.status === "pending_payment" && !isCardPaymentBrick) {
        for (const it of order.items) {
          const product = await tx.product.findUnique({
            where: { id: it.productId },
            select: { stock: true },
          });

          if (it.productVariantId) {
            await tx.productVariant.update({
              where: { id: it.productVariantId },
              data: { stock: { increment: it.quantity } },
            });
          }

          const updatedProduct = await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
            select: { id: true, stock: true },
          });

          if ((product?.stock ?? 0) <= 0 && updatedProduct.stock > 0) {
            restoredProductIds.add(updatedProduct.id);
          }
        }
        await tx.order.update({
          where: { id: order.id },
          data: { status: mpStatus === "refunded" ? "refunded" : "cancelled" },
        });
      }
    }
  });

  if (!confirmationOk) return;

  if (paymentRowId && mpStatus !== "pending" && mpStatus !== "unknown") {
    await cancelOrderPaymentEmailJobs(orderId, paymentRowId).catch(() => {});
  }

  // Notificaciones fuera de la transacción.
  await dispatchOrderEmailNotifications(emailNotificationIds);

  if (mpStatus === "approved") {
    await syncMetaPurchaseForOrder(orderId, { req });
  }

  if (shouldSendRejectedEmail && emailTo) {
    const baseUrl = publicBaseUrl(req);
    const rejectedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1 },
              },
            },
          },
        },
      },
    });
    const rejectedItemsSubtotal = rejectedOrder?.items.reduce((acc, item) => acc + Number(item.subtotal), 0) ?? 0;
    await queueAndSendEmailNotification({
      templateKey: "payment-rejected",
      to: emailTo,
      orderId,
      paymentId: paymentRowId,
      idempotencyKey: `payment-rejected:${paymentId}`,
      payload: {
        customerName: emailName || emailTo,
        orderNumber: orderNumber ? `#${orderNumber}` : orderId,
        productsHtml: rejectedOrder ? emailOrderItemsHtml(rejectedOrder.items, baseUrl, { subtotal: rejectedItemsSubtotal, shipping: rejectedOrder.shippingAmount, total: rejectedOrder.total }) : "",
        productsText: rejectedOrder ? emailOrderItemsText(rejectedOrder.items, { subtotal: rejectedItemsSubtotal, shipping: rejectedOrder.shippingAmount, total: rejectedOrder.total }) : "",
        paymentAmount: `$${orderTotal.toLocaleString("es-AR")}`,
        paymentMethod: payment.payment_method_id ? String(payment.payment_method_id) : "Mercado Pago",
        paymentStatus: mpStatus,
        rejectionReason: payment.status_detail ? String(payment.status_detail) : "No informado",
        retryPaymentUrl: `${baseUrl}/pay/pending?orderId=${orderId}`,
        supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || "soporte@fikastore",
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
    }).catch(() => {});
  }

  await Promise.all(Array.from(restoredProductIds).map((productId) => notifyBackInStock(productId, req)));
}

async function upsertOrderApiAndUpdateOrder(orderData: any, req?: Request) {
  const orderId = typeof orderData?.external_reference === "string" ? orderData.external_reference : "";
  const connectedUserId = await expectedConnectedUserId();
  let emailNotificationIds: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    const confirmation = await reconcileMercadoPagoFinancialConfirmation(
      tx,
      {
        flow: "checkout_api_order",
        order: orderData,
        expectedConnectedUserId: connectedUserId,
      },
      { fallbackOrderId: orderId },
    );
    if (confirmation.ok && confirmation.status === "approved" && confirmation.orderId && confirmation.orderPaidChanged) {
      const payments = (orderData?.transactions?.payments || []) as Record<string, unknown>[];
      emailNotificationIds = await enqueuePaidOrderEmailsInTransaction(tx, {
        orderId: confirmation.orderId,
        paymentId: confirmation.paymentId,
        payment: payments[0] || { provider: "Mercado Pago" },
        req,
      });
    }
    return confirmation;
  });

  if (!result.ok) {
    throw new Error(`MP order evidence rejected mpOrderId=${String(orderData?.id || "")} orderId=${orderId} reason=${result.reason} status=${result.status}`);
  }

  if (result.status === "approved" && result.orderId) {
    await cancelOrderPaymentEmailJobs(result.orderId).catch(() => {});
    await dispatchOrderEmailNotifications(emailNotificationIds);
    await syncMetaPurchaseForOrder(result.orderId, { req });
  } else if (result.ok && result.orderId && ["rejected", "cancelled", "refunded"].includes(result.status)) {
    await cancelOrderPaymentEmailJobs(result.orderId).catch(() => {});
  }
}

export async function POST(req: Request) {
  let body: MpWebhookBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const url = new URL(req.url);
  const topic =
    url.searchParams.get("topic") ||
    url.searchParams.get("type") ||
    body?.type ||
    body?.topic;

  const dataId =
    url.searchParams.get("id") ||
    url.searchParams.get("data.id") ||
    body?.data?.id ||
    body?.id ||
    body?.resource?.split?.("/")?.pop?.();

  // Nos interesa "payment", "merchant_order" de Checkout Pro y "order" de Orders API.
  if ((topic && topic !== "payment" && topic !== "merchant_order" && topic !== "order") || !dataId) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (topic === "merchant_order") {
      const merchantOrder = await fetchMerchantOrder(String(dataId));
      const payments = Array.isArray(merchantOrder?.payments) ? merchantOrder.payments : [];

      for (const p of payments) {
        if (!p?.id) continue;

        const payment = await fetchPayment(String(p.id));
        await upsertPaymentAndUpdateOrder(payment, req);
      }
    } else if (topic === "order") {
      const bodyOrder = body?.data && typeof body.data === "object" && body.data.external_reference
        ? body.data
        : null;
      const orderData = bodyOrder || await fetchCheckoutApiOrder(String(dataId));
      await upsertOrderApiAndUpdateOrder(orderData, req);
    } else {
      const payment = await fetchPayment(String(dataId));
      await upsertPaymentAndUpdateOrder(payment, req);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("MP webhook error", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
