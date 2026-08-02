import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { publicBaseUrl } from "@/lib/publicUrl";
import { queueAndSendEmailNotification } from "@/lib/emailNotificationService";


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  // Regla simple MVP: solo podés enviar si está paid
  if (order.status !== "paid") {
    return NextResponse.json(
      { ok: false, error: "Solo se puede marcar como enviado un pedido pagado." },
      { status: 400 }
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "shipped",
      shippedAt: new Date(),
    },
  });
  // Enviar mail al cliente
  const user = await prisma.user.findUnique({ where: { id: updated.userId } });

  if (user?.email) {
    const baseUrl = publicBaseUrl(req);
    await queueAndSendEmailNotification({
      templateKey: "order-shipped",
      to: user.email,
      recipientUserId: user.id,
      orderId: updated.id,
      idempotencyKey: `order-shipped:${updated.id}`,
      payload: {
        customerName: user.name || user.email,
        orderNumber: updated.orderNumber ? `#${updated.orderNumber}` : updated.id,
        orderUrl: `${baseUrl}/account/orders/${updated.id}`,
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, order: updated });
}
