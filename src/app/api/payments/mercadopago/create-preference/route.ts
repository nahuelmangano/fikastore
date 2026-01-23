import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  const envUrl = process.env.SITE_URL || process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";

  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return "http://localhost:3000";
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ ok: false, error: "orderId inválido." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  if (order.status === "paid") {
    return NextResponse.json({ ok: false, error: "La orden ya está pagada." }, { status: 400 });
  }

  // 🔁 Si ya existe un payment con preference + initPoint → reutilizar
  const existingPayment = order.payments.find(
    (p) => p.provider === "mercadopago" && p.preferenceId && p.initPoint
  );

  if (existingPayment) {
    return NextResponse.json({
      ok: true,
      preferenceId: existingPayment.preferenceId,
      initPoint: existingPayment.initPoint,
      reused: true,
    });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "MP_ACCESS_TOKEN no configurado." },
      { status: 500 }
    );
  }

  const site = baseUrl(req);
  const isLocalhost = /localhost|127\.0\.0\.1/i.test(site);

  const items = order.items.map((it) => ({
    title: it.nameSnapshot,
    quantity: it.quantity,
    unit_price: Number(it.unitPrice),
    currency_id: "ARS",
  }));

  const body: Record<string, unknown> = {
    items,
    external_reference: order.id,
    notification_url: `${site}/api/webhooks/mercadopago`,
    metadata: {
      order_id: order.id,
      user_id: userId,
    },
  };

  if (!isLocalhost) {
    body.back_urls = {
      success: `${site}/pay/success?orderId=${order.id}`,
      failure: `${site}/pay/failure?orderId=${order.id}`,
      pending: `${site}/pay/pending?orderId=${order.id}`,
    };
    body.auto_return = "approved";
  }

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const mpData = await mpRes.json().catch(() => ({}));

  if (!mpRes.ok) {
    return NextResponse.json(
      { ok: false, error: "Error creando preferencia.", details: mpData },
      { status: 502 }
    );
  }

  const preferenceId = mpData.id as string | undefined;
  const initPoint = mpData.init_point as string | undefined;

  if (!preferenceId || !initPoint) {
    return NextResponse.json(
      { ok: false, error: "Respuesta inválida de Mercado Pago.", details: mpData },
      { status: 502 }
    );
  }

  // 💾 Guardar preference + initPoint
  const existing = await prisma.payment.findFirst({
    where: { orderId: order.id, provider: "mercadopago" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: {
        preferenceId,
        initPoint,
        status: "pending",
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        orderId: order.id,
        provider: "mercadopago",
        status: "pending",
        preferenceId,
        initPoint,
      },
    });
  }

  return NextResponse.json({ ok: true, preferenceId, initPoint, reused: false });
}
