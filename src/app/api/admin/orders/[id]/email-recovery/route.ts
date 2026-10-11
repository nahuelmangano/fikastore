import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { dispatchOrderEmailNotifications, enqueuePaidOrderEmailsInTransaction } from "@/lib/orderEmailNotifications";
import { isPaidOrderEmailEligible } from "@/lib/orderEmailNotificationPolicy";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      payments: { select: { id: true, provider: true, status: true, paymentId: true } },
      refunds: { select: { status: true } },
    },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  if (String(body.orderNumber || "") !== String(order.orderNumber || "")) {
    return NextResponse.json({ ok: false, error: "Confirmá el número de pedido para recuperar correos." }, { status: 400 });
  }
  if (body.confirmNoPriorDelivery !== true) {
    return NextResponse.json({ ok: false, error: "Confirmá que no hubo entrega previa de los correos." }, { status: 400 });
  }
  if (!isPaidOrderEmailEligible(order)) {
    return NextResponse.json({ ok: false, error: "El pedido no tiene estado pagado elegible para recuperación." }, { status: 409 });
  }

  let notificationIds: string[] = [];
  await prisma.$transaction(async (tx) => {
    notificationIds = await enqueuePaidOrderEmailsInTransaction(tx, {
      orderId: order.id,
      paymentId: order.payments.find((payment) => payment.status === "approved")?.id,
      payment: order.payments.find((payment) => payment.status === "approved") || { provider: "Pago confirmado" },
      req,
    });
  });
  await dispatchOrderEmailNotifications(notificationIds);

  const notifications = await prisma.emailNotification.findMany({
    where: { id: { in: notificationIds } },
    select: { id: true, templateKey: true, status: true, attemptCount: true, sentAt: true },
  });
  return NextResponse.json({ ok: true, notifications });
}
