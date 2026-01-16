import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { orderPaidTemplate } from "@/lib/email-templates";

type MpWebhookBody = any;

async function fetchPayment(paymentId: string) {
  const token = process.env.MP_ACCESS_TOKEN;
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
  const token = process.env.MP_ACCESS_TOKEN;
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

async function upsertPaymentAndUpdateOrder(payment: any) {
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
  let orderItems: { name: string; qty: number; unit: number; subtotal: number }[] = [];

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
      include: { items: true },
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
          orderItems = order.items.map((it: any) => ({
            name: it.nameSnapshot,
            qty: it.quantity,
            unit: Number(it.unitPrice),
            subtotal: Number(it.subtotal),
          }));
        }
      }
      return;
    }

    if (mpStatus === "rejected" || mpStatus === "cancelled" || mpStatus === "refunded") {
      if (order.status === "pending_payment") {
        for (const it of order.items) {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
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
    const html = orderPaidTemplate({
      customerName: emailName,
      orderId,
      total: orderTotal,
      items: orderItems,
    });

    await sendMail({
      to: emailTo,
      subject: "FikaStore · Pago confirmado ✅",
      html,
    }).catch(() => {});
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

        await upsertPaymentAndUpdateOrder(payment);
      }
    } else {
      const payment = await fetchPayment(String(dataId));
      await upsertPaymentAndUpdateOrder(payment);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("MP webhook error", e);
    return NextResponse.json({ ok: true });
  }
}
