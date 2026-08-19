import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { publicBaseUrl } from "@/lib/publicUrl";
import { renderEmailTemplate } from "@/lib/emailNotificationService";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";

type Body = {
  action?: "preview" | "send";
  customMessage?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function customMessageHtml(value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  return `
    <div style="border:1px solid #ddd;background:#fafafa;padding:14px 16px;margin:0 0 22px;color:#444;font-size:14px;line-height:1.55;">
      ${lines.map((line) => `<p style="margin:0 0 8px;">${escapeHtml(line)}</p>`).join("")}
    </div>
  `;
}

function injectCustomMessage(rendered: { subject: string; html: string; text: string }, customMessage: string) {
  const html = customMessageHtml(customMessage);
  const text = customMessage.trim();
  if (!html && !text) return rendered;

  const firstEscapedLine = customMessage
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const alreadyInHtml = firstEscapedLine ? rendered.html.includes(escapeHtml(firstEscapedLine)) : true;
  const alreadyInText = text ? rendered.text.includes(text) : true;

  return {
    ...rendered,
    html: alreadyInHtml
      ? rendered.html
      : rendered.html.replace(/(<p\b[^>]*>[\s\S]*?<\/p>)/, `$1${html}`),
    text: alreadyInText
      ? rendered.text
      : rendered.text.replace(/(fue enviado\.?)/i, `$1\n${text}`),
  };
}

async function denyUnlessStaff() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  return isStaffRole(role) ? null : NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

async function orderPayload(req: Request, id: string, customMessage: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  if (!order) return { error: NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 }) };
  if (!order.user?.email) {
    return { error: NextResponse.json({ ok: false, error: "El pedido no tiene email de cliente." }, { status: 400 }) };
  }
  if (order.status !== "shipped") {
    return { error: NextResponse.json({ ok: false, error: "Primero marcá el pedido como enviado." }, { status: 400 }) };
  }

  const baseUrl = publicBaseUrl(req);
  const payload = {
    customerName: order.user.name || order.user.email,
    orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
    orderUrl: `${baseUrl}/account/orders/${order.id}`,
    storeName: "FikaStore",
    storeUrl: baseUrl,
    customMessageHtml: customMessageHtml(customMessage),
    customMessageText: customMessage.trim(),
  };

  return { order, user: order.user, payload };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await denyUnlessStaff();
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Body | null;
  const action = body?.action === "send" ? "send" : "preview";
  const customMessage = String(body?.customMessage || "").trim().slice(0, 2000);

  const data = await orderPayload(req, id, customMessage);
  if (data.error) return data.error;

  if (action === "preview") {
    const rendered = injectCustomMessage(await renderEmailTemplate("order-shipped", data.payload), customMessage);
    return NextResponse.json({
      ok: true,
      to: data.user.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }

  const rendered = injectCustomMessage(await renderEmailTemplate("order-shipped", data.payload), customMessage);
  await sendMail({
    to: data.user.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });

  const idempotencyKey = `order-shipped-manual:${data.order.id}:${Date.now()}`;
  const notification = await prisma.emailNotification.create({
    data: {
      templateKey: "order-shipped",
      recipientEmail: data.user.email,
      recipientUserId: data.user.id,
      orderId: data.order.id,
      idempotencyKey,
      status: "sent",
      payloadJson: JSON.stringify(data.payload),
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

  return NextResponse.json({
    ok: true,
    notification: { id: notification.id, status: notification.status, sentAt: notification.sentAt },
  });
}
