import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrderContactEmail, normalizeOrderEmail } from "@/lib/orderAccess";

export const runtime = "nodejs";

function parseOrderNumber(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderNumber = parseOrderNumber(body.orderNumber);
  const email = normalizeOrderEmail(body.email);

  if (!orderNumber || !email) {
    return NextResponse.json({ ok: false, error: "Número de pedido o email inválido." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { user: { select: { email: true } } },
  });

  if (!order || getOrderContactEmail(order) !== email) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, orderId: order.id, orderNumber: order.orderNumber, email });
}
