import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { publicBaseUrl } from "@/lib/publicUrl";
import { renderEmailTemplate } from "@/lib/emailNotificationService";
import { sendMail } from "@/lib/mailer";
import { buildPublicOrderUrl, getOrderContactEmail, getOrderCustomerName } from "@/lib/orderAccess";

type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

async function sendShippedEmail(req: Request, orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!order) return { ok: false as const, error: "Order not found" };

  const recipientEmail = getOrderContactEmail(order);
  if (!recipientEmail) return { ok: false as const, error: "El pedido no tiene email de cliente." };

  const baseUrl = publicBaseUrl(req);
  const payload = {
    customerName: getOrderCustomerName(order),
    orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
    orderUrl: buildPublicOrderUrl(baseUrl, order),
    storeName: "FikaStore",
    storeUrl: baseUrl,
    customMessageHtml: "",
    customMessageText: "",
  };

  const rendered = (await renderEmailTemplate("order-shipped", payload)) as RenderedEmail;
  await sendMail({
    to: recipientEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  const notification = await prisma.emailNotification.create({
    data: {
      templateKey: "order-shipped",
      recipientEmail,
      recipientUserId: order.user?.id,
      orderId: order.id,
      idempotencyKey: `order-shipped-auto:${order.id}:${Date.now()}`,
      status: "sent",
      payloadJson: JSON.stringify(payload),
      sentAt: new Date(),
      lastAttemptAt: new Date(),
      attemptCount: 1,
      attempts: {
        create: {
          status: "sent",
        },
      },
    },
  });

  return { ok: true as const, notification };
}

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

  const emailResult = await sendShippedEmail(req, order.id).catch((error: unknown) => ({
    ok: false as const,
    error: error instanceof Error ? error.message : "No se pudo enviar el mail de pedido enviado.",
  }));

  return NextResponse.json({
    ok: true,
    order: updated,
    shipEmail: emailResult,
  });
}
