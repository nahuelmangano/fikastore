import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { orderPaidTemplate } from "@/lib/email-templates";
import { getMailingSettings, getResolvedMercadoPagoAccessToken } from "@/lib/storeSettings";
import { notifyBackInStock } from "@/lib/stockNotifications";
import { publicBaseUrl } from "@/lib/publicUrl";

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

function absoluteUrl(value: string | null | undefined, req?: Request) {
  const url = String(value || "").trim();
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return `${publicBaseUrl(req)}${url.startsWith("/") ? url : `/${url}`}`;
}

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
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

  // Datos para enviar mail (solo si pasa a paid)
  let shouldSendPaidEmail = false;
  let emailTo: string | null = null;
  let emailName = "";
  let orderTotal = 0;
  let orderNumber: number | undefined;
  let orderDate: Date | undefined;
  let shippingInfo: Parameters<typeof orderPaidTemplate>[0]["shipping"];
  let billingAddress: Parameters<typeof orderPaidTemplate>[0]["billingAddress"];
  let paymentInfo: Parameters<typeof orderPaidTemplate>[0]["payment"];
  let subtotal = 0;
  let discount = 0;
  let orderItems: Parameters<typeof orderPaidTemplate>[0]["items"] = [];
  const restoredProductIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: { provider: "mercadopago", paymentId },
    });

    if (existing) {
      await tx.payment.update({
        where: { id: existing.id },
        data: {
          status: mpStatus,
          rawJson: JSON.stringify(payment).slice(0, 4000),
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId,
          provider: "mercadopago",
          status: mpStatus,
          paymentId,
          preferenceId: payment.preference_id ? String(payment.preference_id) : undefined,
          rawJson: JSON.stringify(payment).slice(0, 4000),
        },
      });
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  where: { visible: true },
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!order) return;

    if (mpStatus === "approved") {
      // Solo si cambia de estado, enviamos mail (idempotente)
      if (order.status !== "paid") {
        await tx.order.update({
          where: { id: order.id },
          data: { status: "paid" },
        });

        const user = await tx.user.findUnique({
          where: { id: order.userId },
          select: { email: true, name: true },
        });

        if (user?.email) {
          shouldSendPaidEmail = true;
          emailTo = user.email;
          emailName = user.name ?? "";
          orderTotal = Number(order.total);
          orderNumber = order.orderNumber ?? undefined;
          orderDate = order.createdAt;
          subtotal = order.items.reduce((acc: number, it: any) => acc + Number(it.subtotal), 0);
          const shippingAmount = Number(order.shippingAmount || 0);
          const reportedPaidAmount = Number(payment.transaction_amount || payment.transaction_details?.total_paid_amount);
          const totalPaid = Number.isFinite(reportedPaidAmount) && reportedPaidAmount > 0 ? reportedPaidAmount : orderTotal;
          discount = Math.max(0, subtotal + shippingAmount - totalPaid);
          shippingInfo = {
            method: order.shippingMethod,
            deliveryType: order.shippingDeliveryType,
            branchName: order.shippingBranchName,
            addressLine: order.shippingAddressLine,
            city: order.shippingCity,
            province: order.shippingProvince,
            zip: order.shippingZip,
            amount: shippingAmount,
          };
          billingAddress = {
            name: order.shippingName,
            addressLine: order.shippingAddressLine,
            city: order.shippingCity,
            province: order.shippingProvince,
            zip: order.shippingZip,
          };
          paymentInfo = {
            provider: "Mercado Pago",
            status: mpStatus,
            method: payment.payment_method_id ? String(payment.payment_method_id) : undefined,
            paymentId,
            installments: Number.isFinite(Number(payment.installments)) ? Number(payment.installments) : undefined,
            amount: totalPaid,
          };
          orderItems = order.items.map((it: any) => {
            const split = splitProductName(it.nameSnapshot);
            return {
              name: split.baseName,
              variantName: split.variantName,
              qty: it.quantity,
              unit: Number(it.unitPrice),
              subtotal: Number(it.subtotal),
              imageUrl: absoluteUrl(it.product?.images?.[0]?.url, req),
            };
          });
        }
      }
      return;
    }

    if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded") {
      if (order.status === "pending_payment") {
        for (const it of order.items) {
          const product = await tx.product.findUnique({
            where: { id: it.productId },
            select: { stock: true },
          });

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

  // ✅ Enviar email fuera de la transacción (mejor práctica)
  if (shouldSendPaidEmail && emailTo) {
    const mailing = await getMailingSettings();
    if (!mailing.purchaseEnabled) {
      await Promise.all(Array.from(restoredProductIds).map((productId) => notifyBackInStock(productId, req)));
      return;
    }

    const html = orderPaidTemplate({
      customerName: emailName,
      orderNumber,
      orderDate,
      orderId,
      payment: paymentInfo,
      shipping: shippingInfo,
      billingAddress,
      subtotal,
      discount,
      total: orderTotal,
      items: orderItems,
      message: mailing.purchaseMessage,
    });

    await sendMail({
      to: emailTo,
      subject: mailing.purchaseSubject,
      html,
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
