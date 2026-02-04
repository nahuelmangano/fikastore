import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { cartAbandonedTemplate, pendingPaymentTemplate } from "@/lib/email-templates";

export const runtime = "nodejs";

function siteUrl() {
  return (process.env.SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("x-cron-secret") === secret;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 10 * 60 * 1000);
  const baseUrl = siteUrl();

  const [carts, payments] = await Promise.all([
    prisma.cartSnapshot.findMany({
      where: {
        updatedAt: { lte: cutoff },
        reminderSentAt: null,
        itemCount: { gt: 0 },
      },
      include: { user: true },
      take: 50,
    }),
    prisma.payment.findMany({
      where: {
        status: "pending",
        pendingReminderSentAt: null,
        order: { status: "pending_payment" },
        pendingAt: { lte: cutoff },
      },
      include: { order: { include: { items: true, user: true } } },
      take: 50,
    }),
  ]);

  let cartSent = 0;
  let pendingSent = 0;

  for (const cart of carts) {
    let items: { name: string; qty: number; unit: number; subtotal: number }[] = [];
    try {
      const parsed = JSON.parse(cart.itemsJson) as {
        name: string;
        price: number;
        quantity: number;
      }[];
      items = parsed.map((it) => ({
        name: it.name,
        qty: it.quantity,
        unit: it.price,
        subtotal: it.price * it.quantity,
      }));
    } catch {
      await prisma.cartSnapshot.update({
        where: { id: cart.id },
        data: { reminderSentAt: new Date() },
      });
      continue;
    }

    const total = items.reduce((acc, it) => acc + it.subtotal, 0);

    await sendMail({
      to: cart.user.email,
      subject: "Tenés productos en tu carrito",
      html: cartAbandonedTemplate({
        customerName: cart.user.name || cart.user.email,
        siteUrl: baseUrl,
        items,
        total,
      }),
    });

    await prisma.cartSnapshot.update({
      where: { id: cart.id },
      data: { reminderSentAt: new Date() },
    });

    cartSent += 1;
  }

  for (const payment of payments) {
    const order = payment.order;
    const items = order.items.map((it) => ({
      name: it.nameSnapshot,
      qty: it.quantity,
      unit: Number(it.unitPrice),
      subtotal: Number(it.subtotal),
    }));

    const total = items.reduce((acc, it) => acc + it.subtotal, 0);

    await sendMail({
      to: order.user.email,
      subject: "Tu pago quedó pendiente",
      html: pendingPaymentTemplate({
        customerName: order.user.name || order.user.email,
        orderNumber: order.orderNumber,
        orderId: order.id,
        siteUrl: baseUrl,
        items,
        total,
      }),
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { pendingReminderSentAt: new Date() },
    });

    pendingSent += 1;
  }

  return NextResponse.json({ ok: true, cartSent, pendingSent });
}
