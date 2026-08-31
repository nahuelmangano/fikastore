/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailingSettings, getResolvedMercadoPagoAccessToken } from "@/lib/storeSettings";
import { notifyBackInStock } from "@/lib/stockNotifications";
import { publicBaseUrl } from "@/lib/publicUrl";
import { cancelScheduledEmailJobs, queueAndSendEmailNotification, renderEmailTemplate } from "@/lib/emailNotificationService";
import { orderPaidTemplate } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { emailOrderItemsHtml, emailOrderItemsText } from "@/lib/emailProductRows";
import { buildPublicOrderUrl, getOrderContactEmail, getOrderCustomerName } from "@/lib/orderAccess";
import { sendMerchantOrderNotification } from "@/lib/merchantOrderNotifications";
import { syncMetaPurchaseForOrder } from "@/lib/meta/conversionsApi";
import { markOrderPaidIfPending } from "@/lib/orderPaymentTransition";

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

function normalizeStatus(mpStatus: string | undefined): string {
  if (!mpStatus) return "unknown";
  const s = mpStatus.toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s === "cancelled") return "cancelled";
  if (s === "refunded" || s === "charged_back") return "refunded";
  if (s === "pending" || s === "in_process" || s === "authorized") return "pending";
  return "unknown";
}

function absoluteUrl(baseUrl: string, value?: string | null) {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

async function sendDetailedPaidEmail(input: {
  orderId: string;
  paymentRowId?: string;
  payment: any;
  req?: Request;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: {
      user: { select: { email: true, name: true } },
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

  const orderEmail = order ? getOrderContactEmail(order) : "";
  if (!order || !orderEmail) return;

  const baseUrl = publicBaseUrl(input.req);
  const publicOrderUrl = buildPublicOrderUrl(baseUrl, order);
  const subtotal = order.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const shippingAmount = Number(order.shippingAmount);
  const paymentAmount = Number(input.payment.transaction_amount || order.total);
  const paymentMethod = input.payment.payment_method_id ? String(input.payment.payment_method_id) : "";
  const subjectPayload = {
    customerName: getOrderCustomerName(order),
    orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
    orderUrl: publicOrderUrl,
    storeName: "FikaStore",
    storeUrl: baseUrl,
  };
  const [mailing, renderedTemplate] = await Promise.all([
    getMailingSettings(),
    renderEmailTemplate("payment-approved", subjectPayload),
  ]);

  if (!renderedTemplate.template.enabled) return;

  await sendMail({
    to: orderEmail,
    subject: renderedTemplate.subject,
    html: orderPaidTemplate({
      customerName: getOrderCustomerName(order),
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt,
      payment: {
        provider: "Mercado Pago",
        status: "approved",
        method: paymentMethod || undefined,
        paymentId: String(input.payment.id || input.paymentRowId || ""),
        installments: Number(input.payment.installments || 0) || undefined,
        amount: paymentAmount,
      },
      shipping: {
        method: order.shippingMethod,
        deliveryType: order.shippingDeliveryType,
        branchName: order.shippingBranchName,
        addressLine: order.shippingAddressLine,
        city: order.shippingCity,
        province: order.shippingProvince,
        zip: order.shippingZip,
        amount: shippingAmount,
      },
      billingAddress: {
        name: order.shippingName,
        addressLine: order.shippingAddressLine,
        city: order.shippingCity,
        province: order.shippingProvince,
        zip: order.shippingZip,
      },
      subtotal,
      discount: 0,
      total: Number(order.total),
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        qty: item.quantity,
        unit: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        imageUrl: absoluteUrl(baseUrl, item.product.images[0]?.url),
      })),
      message: mailing.purchaseMessage,
    }),
  });
}

async function upsertPaymentAndUpdateOrder(payment: any, req?: Request) {
  const mpStatus = normalizeStatus(payment.status);
  const paymentId = String(payment.id);
  const orderId =
    payment.metadata?.order_id ||
    payment.external_reference ||
    payment.additional_info?.items?.[0]?.id;

  if (!orderId || typeof orderId !== "string") {
    await prisma.payment
      .create({
        data: {
          orderId: "unknown",
          provider: "mercadopago",
          status: mpStatus,
          paymentId,
          rawJson: JSON.stringify(payment).slice(0, 4000),
        },
      })
      .catch(() => {});
    return;
  }

  // Datos para notificar fuera de la transacción.
  let shouldSendPaidEmail = false;
  let shouldSendRejectedEmail = false;
      let emailTo: string | null = null;
  let emailName = "";
  let orderTotal = 0;
  let orderNumber: number | undefined;
  let paymentRowId: string | undefined;
  const restoredProductIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { provider: "mercadopago", paymentId },
    });

    if (existing) {
      const updatedPayment = await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: mpStatus,
          rawJson: JSON.stringify(payment).slice(0, 4000),
        },
      });
      paymentRowId = updatedPayment.id;
    } else {
      const createdPayment = await tx.payment.create({
        data: {
          orderId,
          provider: "mercadopago",
          status: mpStatus,
          paymentId,
          preferenceId: payment.preference_id ? String(payment.preference_id) : undefined,
          rawJson: JSON.stringify(payment).slice(0, 4000),
          pendingAt: mpStatus === "pending" ? new Date() : undefined,
        },
      });
      paymentRowId = createdPayment.id;
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true, user: { select: { email: true, name: true } } },
    });
    if (!order) return;

    if (mpStatus === "approved") {
      // Solo si cambia de estado, enviamos mail (idempotente)
      const paidTransition = await markOrderPaidIfPending(tx, order.id);
      if (paidTransition.changed) {

        const orderEmail = getOrderContactEmail(order);
        if (orderEmail) {
          shouldSendPaidEmail = true;
          emailTo = orderEmail;
          emailName = order.user?.name ?? order.shippingName ?? order.contactEmail ?? "";
          orderTotal = Number(order.total);
          orderNumber = order.orderNumber ?? undefined;
        }
      }
      return;
    }

    if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded") {
      const orderEmail = getOrderContactEmail(order);
      if (mpStatus === "rejected" && orderEmail) {
        shouldSendRejectedEmail = true;
        emailTo = orderEmail;
        emailName = order.user?.name ?? order.shippingName ?? order.contactEmail ?? "";
        orderTotal = Number(order.total);
        orderNumber = order.orderNumber ?? undefined;
      }

      if (order.status === "pending_payment") {
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

  if (paymentRowId && mpStatus !== "pending" && mpStatus !== "unknown") {
    await cancelScheduledEmailJobs({ paymentId: paymentRowId, type: "payment-pending-initial" }).catch(() => {});
    await cancelScheduledEmailJobs({ orderId, type: "payment-pending-initial" }).catch(() => {});
    await cancelScheduledEmailJobs({ paymentId: paymentRowId, type: "payment-reminder" }).catch(() => {});
    await cancelScheduledEmailJobs({ orderId, type: "payment-reminder" }).catch(() => {});
  }

  // Notificaciones fuera de la transacción.
  if (shouldSendPaidEmail && emailTo) {
    await sendDetailedPaidEmail({ orderId, paymentRowId, payment, req }).catch(() => {});
    await sendMerchantOrderNotification({
      orderId,
      trigger: "paid",
      paymentLabel: "Mercado Pago",
      req,
    }).catch(() => {});
  }

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
    body?.data?.id ||
    body?.id ||
    body?.resource?.split?.("/")?.pop?.();

  // Nos interesa "payment" y "merchant_order"
  if ((topic && topic !== "payment" && topic !== "merchant_order") || !dataId) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (topic === "merchant_order") {
      const merchantOrder = await fetchMerchantOrder(String(dataId));
      const payments = Array.isArray(merchantOrder?.payments) ? merchantOrder.payments : [];
      const externalReference = merchantOrder?.external_reference;

      for (const p of payments) {
        if (!p?.id) continue;

        const payment =
          p?.status
            ? {
                id: p.id,
                status: p.status,
                external_reference: externalReference,
                preference_id: p.preference_id,
              }
            : await fetchPayment(String(p.id));

        await upsertPaymentAndUpdateOrder(payment, req);
      }
    } else {
      const payment = await fetchPayment(String(dataId));
      await upsertPaymentAndUpdateOrder(payment, req);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("MP webhook error", e);
    return NextResponse.json({ ok: true });
  }
}
