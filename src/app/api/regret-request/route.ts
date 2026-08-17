import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMailingSettings } from "@/lib/storeSettings";
import { sendMail } from "@/lib/mailer";

export const runtime = "nodejs";

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function clean(value: unknown, max = 1000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    orderNumber?: unknown;
    comments?: unknown;
  } | null;

  if (!body) return bad("Datos inválidos.");

  const name = clean(body.name, 120);
  const email = clean(body.email, 180).toLowerCase();
  const phone = clean(body.phone, 80);
  const orderNumberRaw = clean(body.orderNumber, 40).replace(/^#/, "");
  const orderNumber = Number(orderNumberRaw);
  const comments = clean(body.comments, 4000);

  if (!name) return bad("Completá el nombre.");
  if (!email || !isEmail(email)) return bad("Completá un email válido.");
  if (!phone) return bad("Completá el teléfono.");
  if (!orderNumberRaw || !Number.isInteger(orderNumber) || orderNumber <= 0) return bad("Completá un número de orden válido.");
  if (!comments) return bad("Completá las aclaraciones.");

  const order = await prisma.order.findFirst({
    where: {
      orderNumber,
      user: { email },
    },
    select: {
      id: true,
      orderNumber: true,
      user: { select: { email: true, name: true } },
    },
  });

  const request = await prisma.regretRequest.create({
    data: {
      orderId: order?.id || null,
      orderNumber,
      name,
      email,
      phone,
      comments,
      status: "PENDING",
    },
  });

  const mailing = await getMailingSettings().catch(() => null);
  const notifyTo =
    process.env.REGRET_REQUEST_NOTIFY_EMAIL ||
    process.env.SUPPORT_EMAIL ||
    mailing?.smtpReplyTo ||
    mailing?.smtpFrom ||
    "";

  if (notifyTo) {
    const subject = `Solicitud de arrepentimiento #${orderNumber}`;
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111;">
        <h2 style="margin:0 0 16px;">Solicitud de arrepentimiento</h2>
        <p><strong>Orden:</strong> #${escapeHtml(String(orderNumber))}</p>
        <p><strong>Pedido encontrado:</strong> ${order ? "Sí" : "No"}</p>
        <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Teléfono:</strong> ${escapeHtml(phone)}</p>
        <p><strong>Aclaraciones:</strong></p>
        <p style="white-space:pre-wrap;">${escapeHtml(comments)}</p>
      </div>
    `;

    sendMail({
      to: notifyTo,
      subject,
      html,
      text: `Solicitud de arrepentimiento\nOrden: #${orderNumber}\nPedido encontrado: ${order ? "Sí" : "No"}\nNombre: ${name}\nEmail: ${email}\nTeléfono: ${phone}\nAclaraciones: ${comments}`,
    }).catch((error) => {
      console.error("regret request notification failed", error instanceof Error ? error.message : error);
    });
  }

  return NextResponse.json({
    ok: true,
    request: {
      id: request.id,
      status: request.status,
      orderMatched: Boolean(order),
    },
  });
}
