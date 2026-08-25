import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/publicUrl";
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
  const updated = await prisma.$transaction(async (tx) => {
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: { status: "paid" },
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

    return { order: updatedOrder, payment };
  });

  if (order.user?.email) {
    const baseUrl = publicBaseUrl(req);
    await queueAndSendEmailNotification({
      templateKey: "payment-approved",
      to: order.user.email,
      recipientUserId: order.user.id,
      orderId: order.id,
      paymentId: updated.payment?.id || paymentId || undefined,
      idempotencyKey: `manual-payment-approved:${order.id}`,
      payload: {
        customerName: order.user.name || order.user.email,
        orderNumber: `#${order.orderNumber}`,
        orderUrl: `${baseUrl}/account/orders/${order.id}`,
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
    }).catch((error) => {
      console.error("manual payment-approved email failed", error instanceof Error ? error.message : error);
    });
  }

  return NextResponse.json({ ok: true, ...updated });
}
