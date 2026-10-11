import type { Prisma } from "@prisma/client";
import { orderPaidTemplate } from "@/lib/email-templates";
import { persistEmailNotificationInTransaction, renderEmailTemplate, dispatchQueuedEmailNotification } from "@/lib/emailNotificationService";
import { getOrderContactEmail, getOrderCustomerName, buildPublicOrderUrl } from "@/lib/orderAccess";
import { resolveNotificationEmail } from "@/lib/notificationEmail";
import { absoluteImageUrl, emailOrderItemsHtml, emailOrderItemsText } from "@/lib/emailProductRows";
import { publicBaseUrl } from "@/lib/publicUrl";
import { getShippingCarriers } from "@/lib/shippingCarriers";
import { DEFAULT_SITE_TITLE, getMailingSettings } from "@/lib/storeSettings";
import { merchantOrderNotificationEmail } from "@/lib/merchantOrderNotifications";
import { isPaidOrderEmailEligible, orderEmailIdempotencyKey } from "@/lib/orderEmailNotificationPolicy";

function textLines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function emailInfoBox(title: string, lines: string[]) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean);
  if (!cleanLines.length) return "";
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  return `<div style="margin:16px 0;"><p style="margin:0 0 8px;color:#111;font-weight:700;">${escape(title)}</p><div style="border:1px solid #ddd;padding:14px 16px;color:#444;font-size:13px;line-height:1.6;">${cleanLines.map((line) => `<div>${escape(line)}</div>`).join("")}</div></div>`;
}

function emailShippingLabel(method: string, carrierName?: string | null, deliveryType?: string | null) {
  if (method === "epick") return "E-pick";
  if (method === "andreani") return "Andreani";
  if (method === "correo") return deliveryType === "S" ? "Correo Argentino - Sucursal" : "Correo Argentino - Domicilio";
  if (method === "pickup") return "Punto de Retiro";
  return carrierName || "Punto de Retiro";
}

type PaidEmailInput = {
  orderId: string;
  paymentId?: string | null;
  payment: Record<string, unknown>;
  req?: Request;
};

type ManualCreatedEmailInput = {
  orderId: string;
  paymentLabel: string;
  paymentInstructions: string;
  paymentDetailsHtml: string;
  req?: Request;
};

function paymentText(payment: Record<string, unknown>, key: string) {
  const value = payment[key];
  return value === undefined || value === null ? "" : String(value);
}

function paymentProviderLabel(value: string) {
  const labels: Record<string, string> = {
    transfer: "Transferencia bancaria",
    cash: "Efectivo",
    agreement: "A convenir",
    manual: "Pago manual",
    mercadopago: "Mercado Pago",
  };
  return labels[value.toLowerCase()] || value;
}

export async function enqueuePaidOrderEmailsInTransaction(
  tx: Prisma.TransactionClient,
  input: PaidEmailInput,
) {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      payments: { orderBy: { createdAt: "desc" } },
      refunds: { select: { status: true } },
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
  if (!order || !isPaidOrderEmailEligible(order)) return [];

  await tx.emailNotification.updateMany({
    where: {
      orderId: order.id,
      idempotencyKey: {
        in: [
          orderEmailIdempotencyKey(order.id, "created-pending", "buyer"),
          orderEmailIdempotencyKey(order.id, "created-pending", "merchant"),
        ],
      },
      status: { in: ["pending", "failed"] },
    },
    data: {
      status: "cancelled",
      lockedAt: null,
      lockedBy: null,
      errorMessage: "Superseded by payment approval",
    },
  });

  const mailing = await getMailingSettings();
  const baseUrl = publicBaseUrl(input.req);
  const buyerEmail = getOrderContactEmail(order);
  const customerName = getOrderCustomerName(order);
  const orderLabel = order.orderNumber ? `#${order.orderNumber}` : order.id;
  const rawProvider = paymentText(input.payment, "provider");
  const template = buyerEmail
    ? await renderEmailTemplate("payment-approved", {
        customerName,
        orderNumber: orderLabel,
        orderUrl: buildPublicOrderUrl(baseUrl, order),
        storeName: "FikaStore",
        storeUrl: baseUrl,
      })
    : null;
  const ids: string[] = [];

  if (template?.template.enabled) {
    const carriers = await getShippingCarriers();
    const carrier = carriers.find((item) => item.key === order.shippingMethod);
    const subtotal = order.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const paymentMethod = paymentText(input.payment, "payment_method_id") || paymentProviderLabel(rawProvider) || "Pago confirmado";
    const orderItemsText = emailOrderItemsText(order.items, {
      subtotal,
      shipping: order.shippingAmount,
      shippingPricingMode: carrier?.pricingMode,
      total: order.total,
    });
    const email = orderPaidTemplate({
      customerName,
      orderId: order.id,
      orderNumber: order.orderNumber ?? undefined,
      orderDate: order.createdAt,
      payment: {
        provider: paymentProviderLabel(rawProvider || "Mercado Pago"),
        status: "approved",
        method: paymentMethod,
        paymentId: paymentText(input.payment, "id") || input.paymentId || undefined,
        installments: Number(input.payment.installments || 0) || undefined,
        amount: Number(input.payment.transaction_amount || order.total),
      },
      shipping: {
        pricingMode: carrier?.pricingMode,
        method: order.shippingMethod,
        deliveryType: order.shippingDeliveryType,
        branchName: order.shippingBranchName,
        addressLine: order.shippingAddressLine || "",
        city: order.shippingCity || "",
        province: order.shippingProvince || "",
        zip: order.shippingZip || "",
        amount: Number(order.shippingAmount),
      },
      billingAddress: {
        name: order.shippingName,
        addressLine: order.shippingAddressLine || "",
        city: order.shippingCity || "",
        province: order.shippingProvince || "",
        zip: order.shippingZip || "",
      },
      subtotal,
      total: Number(order.total),
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        variantName: item.variantSnapshot || undefined,
        qty: item.quantity,
        unit: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        imageUrl: absoluteImageUrl(baseUrl, item.product.images[0]?.url),
      })),
      message: mailing.purchaseMessage,
    });

    const buyerNotification = await persistEmailNotificationInTransaction(tx, {
      templateKey: "payment-approved",
      to: buyerEmail,
      recipientUserId: order.user?.id,
      orderId: order.id,
      paymentId: input.paymentId || order.payments[0]?.id,
      idempotencyKey: orderEmailIdempotencyKey(order.id, "payment-approved", "buyer"),
      payload: {
        __renderedEmail: {
          subject: template.subject,
          html: email,
          text: [
            `Pedido ${orderLabel}: pago confirmado.`,
            `Fecha: ${order.createdAt.toLocaleDateString("es-AR")}`,
            `Medio de pago: ${paymentMethod}`,
            orderItemsText,
            `Total: ${Number(order.total).toLocaleString("es-AR")}`,
            `Ver pedido: ${buildPublicOrderUrl(baseUrl, order)}`,
          ].join("\n"),
        },
      },
    });
    ids.push(buyerNotification.id);
  }

  const merchantEmail = resolveNotificationEmail(mailing);
  if (merchantEmail) {
    const paymentRow = order.payments.find((payment) => payment.status === "approved") || order.payments[0];
    const merchant = merchantOrderNotificationEmail({
      storeName: DEFAULT_SITE_TITLE,
      trigger: "paid",
      orderNumber: order.orderNumber ?? order.id,
      orderDate: order.createdAt,
      customerName: order.shippingName || order.user?.name || "Cliente",
      customerDni: order.dni,
      customerEmail: buyerEmail || "Sin email",
      customerPhone: order.shippingPhone || "-",
      paymentLabel: paymentProviderLabel(rawProvider || paymentText(input.payment, "payment_method_id") || "Pago confirmado"),
      paymentStatus: "approved",
      paymentId: paymentText(input.payment, "id") || input.paymentId || paymentRow?.paymentId || null,
      subtotal: order.items.reduce((sum, item) => sum + Number(item.subtotal), 0),
      shippingAmount: Number(order.shippingAmount),
      total: Number(order.total),
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        variantSnapshot: item.variantSnapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        imageUrl: absoluteImageUrl(baseUrl, item.product.images[0]?.url),
      })),
      shippingMethod: order.shippingMethod,
      shippingDeliveryType: order.shippingDeliveryType,
      shippingBranchName: order.shippingBranchName,
      shippingAddressLine: order.shippingAddressLine,
      shippingFloor: order.shippingFloor,
      shippingApartment: order.shippingApartment,
      shippingCity: order.shippingCity,
      shippingProvince: order.shippingProvince,
      shippingZip: order.shippingZip,
      adminOrderUrl: `${baseUrl}/admin/orders/${order.id}`,
    });
    const merchantNotification = await persistEmailNotificationInTransaction(tx, {
      templateKey: "merchant-payment-approved",
      to: merchantEmail,
      orderId: order.id,
      paymentId: input.paymentId || paymentRow?.id,
      idempotencyKey: orderEmailIdempotencyKey(order.id, "payment-approved", "merchant"),
      payload: { __renderedEmail: merchant },
    });
    ids.push(merchantNotification.id);
  }

  return ids;
}

export async function enqueueManualOrderCreatedEmailsInTransaction(
  tx: Prisma.TransactionClient,
  input: ManualCreatedEmailInput,
) {
  const order = await tx.order.findUnique({
    where: { id: input.orderId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      payments: { orderBy: { createdAt: "desc" } },
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
  if (!order || order.status !== "pending_payment") return [];

  const buyerEmail = getOrderContactEmail(order);
  const mailing = await getMailingSettings();
  const baseUrl = publicBaseUrl(input.req);
  const carriers = await getShippingCarriers();
  const carrier = carriers.find((item) => item.key === order.shippingMethod);
  const shippingLabel = emailShippingLabel(order.shippingMethod || "", carrier?.name, order.shippingDeliveryType);
  const shippingLines = order.shippingMethod === "pickup"
    ? ["Punto de Retiro.", "Te vamos a contactar cuando el pedido esté listo para retirar."]
    : order.shippingMethod === "correo" && order.shippingDeliveryType === "S"
      ? [order.shippingBranchName ? `Sucursal: ${order.shippingBranchName}` : "Retiro en sucursal de Correo Argentino.", order.shippingAddressLine || "", [order.shippingCity, order.shippingProvince].filter(Boolean).join(", "), order.shippingZip ? `CP ${order.shippingZip}` : ""]
      : [`Destinatario: ${order.shippingName}`, order.shippingPhone ? `Teléfono: ${order.shippingPhone}` : "", order.shippingAddressLine || "", [order.shippingCity, order.shippingProvince].filter(Boolean).join(", "), order.shippingZip ? `CP ${order.shippingZip}` : ""];
  const shippingInstructions = [`Método de envío: ${shippingLabel}`, ...(carrier?.description ? textLines(carrier.description) : []), ...shippingLines];
  const subtotal = order.items.reduce((sum, item) => sum + Number(item.subtotal), 0);
  const itemsHtml = emailOrderItemsHtml(order.items, baseUrl, {
    subtotal,
    shipping: order.shippingAmount,
    shippingPricingMode: carrier?.pricingMode,
    total: order.total,
  });
  const itemsText = emailOrderItemsText(order.items, {
    subtotal,
    shipping: order.shippingAmount,
    shippingPricingMode: carrier?.pricingMode,
    total: order.total,
  });
  const ids: string[] = [];

  if (buyerEmail) {
    const buyerNotification = await persistEmailNotificationInTransaction(tx, {
      templateKey: "payment-pending",
      to: buyerEmail,
      recipientUserId: order.user?.id,
      orderId: order.id,
      paymentId: order.payments[0]?.id,
      idempotencyKey: orderEmailIdempotencyKey(order.id, "created-pending", "buyer"),
      payload: {
        customerName: getOrderCustomerName(order),
        orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
        productsHtml: itemsHtml,
        productsText: itemsText,
        paymentAmount: `$${Number(order.total).toLocaleString("es-AR")}`,
        paymentMethod: input.paymentLabel,
        paymentInstructions: input.paymentInstructions,
        paymentDetailsHtml: input.paymentDetailsHtml,
        shippingMethod: shippingLabel,
        shippingInstructions: shippingInstructions.join(". "),
        shippingDetailsHtml: emailInfoBox("Envío", shippingInstructions),
        paymentDueDate: "No informada",
        paymentUrl: buildPublicOrderUrl(baseUrl, order),
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
    });
    ids.push(buyerNotification.id);
  }

  const merchantEmail = resolveNotificationEmail(mailing);
  if (merchantEmail) {
    const merchant = merchantOrderNotificationEmail({
      storeName: DEFAULT_SITE_TITLE,
      trigger: "created",
      orderNumber: order.orderNumber ?? order.id,
      orderDate: order.createdAt,
      customerName: order.shippingName || order.user?.name || "Cliente",
      customerDni: order.dni,
      customerEmail: buyerEmail || "Sin email",
      customerPhone: order.shippingPhone || "-",
      paymentLabel: input.paymentLabel,
      paymentStatus: "pending",
      subtotal,
      shippingAmount: Number(order.shippingAmount),
      total: Number(order.total),
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        variantSnapshot: item.variantSnapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.subtotal),
        imageUrl: absoluteImageUrl(baseUrl, item.product.images[0]?.url),
      })),
      shippingMethod: order.shippingMethod,
      shippingDeliveryType: order.shippingDeliveryType,
      shippingBranchName: order.shippingBranchName,
      shippingAddressLine: order.shippingAddressLine,
      shippingFloor: order.shippingFloor,
      shippingApartment: order.shippingApartment,
      shippingCity: order.shippingCity,
      shippingProvince: order.shippingProvince,
      shippingZip: order.shippingZip,
      adminOrderUrl: `${baseUrl}/admin/orders/${order.id}`,
    });
    const merchantNotification = await persistEmailNotificationInTransaction(tx, {
      templateKey: "merchant-order-created",
      to: merchantEmail,
      orderId: order.id,
      paymentId: order.payments[0]?.id,
      idempotencyKey: orderEmailIdempotencyKey(order.id, "created-pending", "merchant"),
      payload: { __renderedEmail: merchant },
    });
    ids.push(merchantNotification.id);
  }

  return ids;
}

export async function dispatchOrderEmailNotifications(ids: string[]) {
  await Promise.all(ids.map(async (id) => {
    try {
      await dispatchQueuedEmailNotification(id);
    } catch (error) {
      console.error("order email dispatch failed", {
        notificationId: id,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }));
}
