import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/publicUrl";
import { queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { absoluteImageUrl, emailProductRowsHtml } from "@/lib/emailProductRows";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("x-cron-secret") === secret;
}

type SnapshotCartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function parseCartItems(itemsJson: string): SnapshotCartItem[] {
  const parsed = JSON.parse(itemsJson);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((item) => ({
      productId: String(item?.productId || "").trim(),
      name: String(item?.name || "").trim(),
      price: Number(item?.price),
      quantity: Math.floor(Number(item?.quantity)),
    }))
    .filter(
      (item) =>
        item.productId &&
        item.name &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    );
}

function cartItemsHtml(items: SnapshotCartItem[], baseUrl: string, imageByProductId: Map<string, string>) {
  if (items.length === 0) return "<p style=\"margin:0;color:#555;\">Tu carrito guardado tiene productos pendientes.</p>";
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  return emailProductRowsHtml(
    items.map((item) => ({
      name: item.name,
      imageUrl: absoluteImageUrl(baseUrl, imageByProductId.get(item.productId)),
      details: [`Cantidad: ${item.quantity}`, `Unitario: ${money(item.price)}`],
      amount: money(item.price * item.quantity),
    })),
    { totalHtml: `<div style="padding-top:12px;text-align:right;font-weight:800;color:#111;">Total: ${money(total)}</div>` }
  );
}

function cartItemsText(items: SnapshotCartItem[]) {
  if (items.length === 0) return "Productos pendientes en tu carrito.";
  const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);
  return `${items.map((item) => `${item.name} x${item.quantity} (${money(item.price * item.quantity)})`).join("; ")}. Total: ${money(total)}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const baseUrl = publicBaseUrl(req);

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
    let items: SnapshotCartItem[] = [];
    try {
      items = parseCartItems(cart.itemsJson);
    } catch {
      await prisma.cartSnapshot.update({
        where: { id: cart.id },
        data: { reminderSentAt: new Date() },
      });
      continue;
    }

    const products = await prisma.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: {
        id: true,
        images: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1, select: { url: true } },
      },
    });
    const imageByProductId = new Map(products.map((product) => [product.id, product.images[0]?.url || ""]));

    await queueAndSendEmailNotification({
      templateKey: "cart-abandoned",
      to: cart.user.email,
      recipientUserId: cart.userId,
      idempotencyKey: `cart-abandoned:${cart.id}`,
      payload: {
        customerName: cart.user.name || cart.user.email,
        cartItemsHtml: cartItemsHtml(items, baseUrl, imageByProductId),
        cartItemsText: cartItemsText(items),
        cartUrl: `${baseUrl}/cart`,
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
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

    await queueAndSendEmailNotification({
      templateKey: "payment-pending-reminder",
      to: order.user.email,
      recipientUserId: order.userId,
      orderId: order.id,
      paymentId: payment.id,
      idempotencyKey: `payment-reminder:${payment.id}:legacy`,
      payload: {
        customerName: order.user.name || order.user.email,
        orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
        paymentAmount: `$${total.toLocaleString("es-AR")}`,
        reminderNumber: "1",
        paymentUrl: `${baseUrl}/pay/pending?orderId=${order.id}`,
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
    });

    await prisma.payment.update({
      where: { id: payment.id },
      data: { pendingReminderSentAt: new Date() },
    });

    pendingSent += 1;
  }

  return NextResponse.json({ ok: true, cartSent, pendingSent });
}
