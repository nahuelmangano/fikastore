import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { publicBaseUrl } from "@/lib/publicUrl";

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();
  const amount = Number(body.amount);
  if (!orderId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "Datos de reembolso inválidos." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const refund = await prisma.refund.create({
    data: {
      orderId: order.id,
      paymentId: String(body.paymentId || order.payments[0]?.id || "").trim() || null,
      returnRequestId: String(body.returnRequestId || "").trim() || null,
      provider: String(body.provider || "mercadopago").trim(),
      providerRefundId: String(body.providerRefundId || "").trim() || null,
      status: "processed",
      amount,
      type: amount >= Number(order.total) ? "total" : "partial",
      processedAt: new Date(),
      rawJson: body.rawJson ? JSON.stringify(body.rawJson).slice(0, 4000) : null,
    },
  });

  const baseUrl = publicBaseUrl(req);
  await queueAndSendEmailNotification({
    templateKey: "refund-completed",
    to: order.user.email,
    recipientUserId: order.userId,
    orderId: order.id,
    paymentId: refund.paymentId,
    refundId: refund.id,
    idempotencyKey: `refund-completed:${refund.id}`,
    payload: {
      customerName: order.user.name || order.user.email,
      orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
      refundAmount: money(Number(refund.amount)),
      paymentMethod: order.payments[0]?.provider || refund.provider,
      refundId: refund.providerRefundId || refund.id,
      refundDate: refund.processedAt?.toLocaleDateString("es-AR") || new Date().toLocaleDateString("es-AR"),
      estimatedAccreditation: "La acreditación puede demorar algunos días hábiles.",
      storeName: "FikaStore",
      storeUrl: baseUrl,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, refund });
}
