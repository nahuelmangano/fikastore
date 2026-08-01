import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type ChatbotOrderStatusBody = {
  orderNumber?: unknown;
  email?: unknown;
  phone?: unknown;
};

function getAuthToken(req: Request) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || req.headers.get("x-chatbot-secret")?.trim() || "";
}

function isAuthorized(req: Request) {
  const secret = process.env.CHATBOT_API_SECRET?.trim();
  if (!secret) return false;
  return getAuthToken(req) === secret;
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizePhone(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : "";
}

function parseOrderNumber(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().replace(/^#/, "");
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function deliveryLabel(order: {
  shippingMethod: string | null;
  shippingDeliveryType: string | null;
  shippingBranchName: string | null;
}) {
  if (order.shippingMethod === "pickup") return "Retiro en tienda";
  if (order.shippingMethod === "correo" && order.shippingDeliveryType === "S") {
    return order.shippingBranchName ? `Sucursal Correo Argentino: ${order.shippingBranchName}` : "Sucursal Correo Argentino";
  }
  if (order.shippingMethod === "correo") return "Correo Argentino a domicilio";
  if (order.shippingMethod === "epick") return "E-pick";
  if (order.shippingMethod === "andreani") return "Andreani";
  return order.shippingMethod || "Sin metodo de envio";
}

export async function POST(req: Request) {
  if (!process.env.CHATBOT_API_SECRET?.trim()) {
    return NextResponse.json(
      { ok: false, error: "CHATBOT_API_SECRET no esta configurado." },
      { status: 503 }
    );
  }

  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as ChatbotOrderStatusBody | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "Body JSON invalido." }, { status: 400 });
  }

  const orderNumber = parseOrderNumber(body.orderNumber);
  const email = normalizeEmail(body.email);
  const phone = normalizePhone(body.phone);

  if (!orderNumber) {
    return NextResponse.json({ ok: false, error: "orderNumber invalido." }, { status: 400 });
  }

  if (!email && !phone) {
    return NextResponse.json(
      { ok: false, error: "Informar email o telefono para validar el pedido." },
      { status: 400 }
    );
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      user: { select: { email: true, name: true } },
      items: { select: { nameSnapshot: true, quantity: true } },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { provider: true, status: true },
      },
      epickShipment: { select: { status: true, epickOrderId: true } },
      correoShipment: { select: { status: true, shippingId: true } },
    },
  });

  const emailMatches = order ? normalizeEmail(order.user.email) === email : false;
  const phoneMatches = order ? normalizePhone(order.shippingPhone) === phone : false;
  const contactMatches = Boolean((email && emailMatches) || (phone && phoneMatches));

  if (!order || !contactMatches) {
    return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });
  }

  const payment = order.payments[0] ?? null;
  const shipment =
    order.shippingMethod === "epick"
      ? order.epickShipment
        ? { provider: "epick", status: order.epickShipment.status, trackingId: order.epickShipment.epickOrderId }
        : null
      : order.shippingMethod === "correo"
        ? order.correoShipment
          ? { provider: "correo", status: order.correoShipment.status, trackingId: order.correoShipment.shippingId }
          : null
        : null;

  return NextResponse.json({
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: payment?.status ?? null,
      paymentProvider: payment?.provider ?? null,
      total: Number(order.total),
      createdAt: order.createdAt,
      shippedAt: order.shippedAt,
      shipping: {
        method: order.shippingMethod,
        deliveryType: order.shippingDeliveryType,
        label: deliveryLabel(order),
        city: order.shippingCity,
        province: order.shippingProvince,
        shipment,
      },
      items: order.items.map((item) => ({
        name: item.nameSnapshot,
        quantity: item.quantity,
      })),
    },
  });
}
