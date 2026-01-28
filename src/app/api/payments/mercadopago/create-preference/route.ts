import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

function baseUrl(req: Request) {
  const envUrl = process.env.SITE_URL || process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const origin = req.headers.get("origin");
  if (origin) return origin.replace(/\/$/, "");

  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";

  if (host) return `${proto}://${host}`.replace(/\/$/, "");

  return "http://localhost:3000";
}

function isLocalSite(url: string) {
  return (
    /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url) ||
    /(^|\/\/)192\.168\./i.test(url) ||
    /(^|\/\/)10\./i.test(url) ||
    /(^|\/\/)172\.(1[6-9]|2\d|3[0-1])\./i.test(url) ||
    /\.local\b|\.lan\b/i.test(url)
  );
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json({ ok: false, error: "orderId inválido." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: { items: true },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  if (order.status === "paid") {
    return NextResponse.json({ ok: false, error: "La orden ya está pagada." }, { status: 400 });
  }

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ ok: false, error: "MP_ACCESS_TOKEN no configurado." }, { status: 500 });
  }

  const site = baseUrl(req);
  const isLocalhost = isLocalSite(site);

  // Items para Mercado Pago
  const items = order.items.map((it) => ({
    title: it.nameSnapshot,
    quantity: it.quantity,
    unit_price: Number(it.unitPrice),
    currency_id: "ARS",
  }));

  const body: Record<string, unknown> = {
    items,
    external_reference: order.id,
    metadata: {
      order_id: order.id,
      user_id: userId,
    },
  };

  if (!isLocalhost) {
    body.notification_url = `${site}/api/webhooks/mercadopago`;
    body.back_urls = {
      success: `${site}/pay/success?orderId=${order.id}`,
      failure: `${site}/pay/failure?orderId=${order.id}`,
      pending: `${site}/pay/pending?orderId=${order.id}`,
    };
    body.auto_return = "approved";
  }

  // Crear preferencia (Checkout Pro)
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
    console.error("MP preference error", mpData);
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

  // Guardar/crear Payment asociado a la orden
  await prisma.payment.create({
    data: {
      orderId: order.id,
      provider: "mercadopago",
      status: "pending",
      preferenceId,
    },
  });

  return NextResponse.json({ ok: true, preferenceId, initPoint });
}
