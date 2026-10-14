import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { ensureDefaultEmailTemplates, queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { buildPublicOrderUrl, getOrderContactEmail, getOrderCustomerName } from "@/lib/orderAccess";
import { publicBaseUrl } from "@/lib/publicUrl";
import { getSiteTitle } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, name: true } } } });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  if (order.status !== "paid") return NextResponse.json({ ok: false, error: "Solo se puede avisar que fue empaquetado un pedido pagado y pendiente de envío." }, { status: 400 });
  const email = getOrderContactEmail(order);
  if (!email) return NextResponse.json({ ok: false, error: "El pedido no tiene email de cliente." }, { status: 400 });

  try {
    await ensureDefaultEmailTemplates();
    const template = await prisma.emailTemplate.findUnique({ where: { key: "order-packed" } });
    if (!template?.enabled) return NextResponse.json({ ok: false, error: "Habilitá el mail Pedido empaquetado en Mailing antes de enviarlo." }, { status: 400 });
    const storeName = await getSiteTitle();
    const baseUrl = publicBaseUrl(req);
    const notification = await queueAndSendEmailNotification({
      templateKey: "order-packed",
      to: email,
      recipientUserId: order.user?.id,
      orderId: order.id,
      idempotencyKey: `order-packed:${order.id}`,
      payload: {
        customerName: getOrderCustomerName(order),
        orderNumber: `#${order.orderNumber}`,
        orderUrl: buildPublicOrderUrl(baseUrl, order),
        storeName,
        storeUrl: baseUrl,
      },
    });
    if (!notification || notification.status === "failed") return NextResponse.json({ ok: false, error: "No se pudo enviar el mail. El intento quedó registrado en Mailing." }, { status: 502 });
    if (notification.status === "cancelled") return NextResponse.json({ ok: false, error: "El envío del mail está cancelado. Revisalo en Mailing." }, { status: 400 });
    return NextResponse.json({ ok: true, status: notification.status, message: notification.status === "sent" ? "Mail de pedido empaquetado enviado al cliente." : "El mail está en proceso. Podés consultar su estado en Mailing." });
  } catch (error) {
    console.error("order packed email failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, error: "No se pudo procesar el mail de pedido empaquetado." }, { status: 500 });
  }
}
