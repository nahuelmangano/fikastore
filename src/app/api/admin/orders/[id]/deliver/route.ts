import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/publicUrl";
import { isStaffRole } from "@/lib/roles";
import { scheduleReviewRequestForOrder } from "@/lib/emailNotificationJobs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  if (order.status !== "shipped" && order.status !== "paid") {
    return NextResponse.json({ ok: false, error: "Solo se puede marcar como entregado un pedido pagado o enviado." }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "delivered",
      deliveredAt: order.deliveredAt || new Date(),
    },
  });

  if (order.user?.email) {
    const baseUrl = publicBaseUrl(req);
    await queueAndSendEmailNotification({
      templateKey: "order-delivered",
      to: order.user.email,
      recipientUserId: order.user.id,
      orderId: order.id,
      idempotencyKey: `order-delivered:${order.id}`,
      payload: {
        customerName: order.user.name || order.user.email,
        orderNumber: `#${order.orderNumber}`,
        orderUrl: `${baseUrl}/account/orders/${order.id}`,
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
    }).catch((error) => {
      console.error("order delivered email failed", error instanceof Error ? error.message : error);
    });
  }

  await scheduleReviewRequestForOrder(updated.id).catch((error) => {
    console.error("review request scheduling failed", error instanceof Error ? error.message : error);
  });

  return NextResponse.json({ ok: true, order: updated });
}
