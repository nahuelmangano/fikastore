import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { cancelOrderPaymentEmailJobs } from "@/lib/emailNotificationService";
import { dispatchOrderEmailNotifications, enqueuePaidOrderEmailsInTransaction } from "@/lib/orderEmailNotifications";
import { syncMetaPurchaseForOrder } from "@/lib/meta/conversionsApi";
import { markOrderPaidIfPending } from "@/lib/orderPaymentTransition";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true, name: true } },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  if (order.status !== "pending_payment") {
    return NextResponse.json(
      { ok: false, error: "Solo se puede marcar como pagado un pedido pendiente de pago." },
      { status: 400 }
    );
  }

  const paymentId = order.payments[0]?.id;
  let emailNotificationIds: string[] = [];
  const updated = await prisma.$transaction(async (tx) => {
    const transition = await markOrderPaidIfPending(tx, order.id);

    const updatedOrder = await tx.order.findUniqueOrThrow({
      where: { id: order.id },
    });

    if (paymentId) {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: "approved",
          pendingAt: null,
        },
      });
    } else {
      await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "manual",
          status: "approved",
        },
      });
    }

    const payment = await tx.payment.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });

    if (transition.changed) {
      emailNotificationIds = await enqueuePaidOrderEmailsInTransaction(tx, {
        orderId: order.id,
        paymentId: payment?.id,
        payment: { id: payment?.paymentId || payment?.id, provider: payment?.provider || "manual" },
        req,
      });
    }

    return { order: updatedOrder, payment };
  });

  await cancelOrderPaymentEmailJobs(order.id, updated.payment?.id).catch(() => {});
  await dispatchOrderEmailNotifications(emailNotificationIds);

  await syncMetaPurchaseForOrder(order.id, { req });

  return NextResponse.json({ ok: true, ...updated });
}
