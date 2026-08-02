import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { queueAndSendEmailNotification } from "@/lib/emailNotificationService";
import { publicBaseUrl } from "@/lib/publicUrl";

function returnCode() {
  return `DEV-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const orderId = String(body.orderId || "").trim();
  const items = (Array.isArray(body.items) ? body.items : []) as Array<{
    productId?: unknown;
    quantity?: unknown;
    reason?: unknown;
  }>;
  const status = String(body.status || "REQUESTED").trim().toUpperCase();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  const orderProductIds = new Set(order.items.map((item) => item.productId));
  const returnItems = items
    .map((item) => ({
      productId: String(item.productId || "").trim(),
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      reason: String(item.reason || "").trim() || null,
    }))
    .filter((item) => item.productId && orderProductIds.has(item.productId));

  if (returnItems.length === 0) {
    return NextResponse.json({ ok: false, error: "Indicá productos válidos del pedido." }, { status: 400 });
  }

  const returnRequest = await prisma.returnRequest.create({
    data: {
      code: returnCode(),
      orderId: order.id,
      userId: order.userId,
      status,
      reason: String(body.reason || "").trim() || null,
      comments: String(body.comments || "").trim() || null,
      approvedAt: status === "APPROVED" ? new Date() : null,
      estimatedAmount: body.estimatedAmount !== undefined ? Number(body.estimatedAmount) : undefined,
      resolutionMethod: String(body.resolutionMethod || "").trim() || null,
      returnInstructions: String(body.returnInstructions || "").trim() || null,
      items: { create: returnItems },
    },
    include: { items: { include: { product: true } } },
  });

  const baseUrl = publicBaseUrl(req);
  const itemsHtml = returnRequest.items
    .map((item) => `<div style="margin:6px 0;"><strong>${item.product.name}</strong> · Cantidad ${item.quantity}</div>`)
    .join("");

  await queueAndSendEmailNotification({
    templateKey: "return-confirmation",
    to: order.user.email,
    recipientUserId: order.userId,
    orderId: order.id,
    returnRequestId: returnRequest.id,
    idempotencyKey: `return-confirmation:${returnRequest.id}:${returnRequest.status}`,
    payload: {
      customerName: order.user.name || order.user.email,
      orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
      returnCode: returnRequest.code,
      returnStatus: returnRequest.status,
      itemsHtml,
      nextSteps: returnRequest.status === "APPROVED" ? "Tu devolución fue aprobada. Seguí las instrucciones para avanzar." : "Recibimos tu solicitud y la vamos a revisar.",
      returnInstructions: returnRequest.returnInstructions || "Te contactaremos con los próximos pasos.",
      storeName: "FikaStore",
      storeUrl: baseUrl,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, returnRequest });
}
