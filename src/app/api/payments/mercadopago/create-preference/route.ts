import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  const envUrl =
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

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
    return NextResponse.json(
      { ok: false, error: "No autorizado." },
      { status: 401 }
    );
  }

  const { orderId } = await req.json().catch(() => ({}));

  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json(
      { ok: false, error: "orderId inválido." },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    return NextResponse.json(
      { ok: false, error: "Orden no encontrada." },
      { status: 404 }
    );
  }

  const token = process.env.MP_ACCESS_TOKEN;

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "MP_ACCESS_TOKEN no configurado." },
      { status: 500 }
    );
  }

  const site = baseUrl(req);

  const items = order.items.map((it) => ({
    title: it.nameSnapshot,
    quantity: it.quantity,
    unit_price: Number(it.unitPrice),
    currency_id: "ARS",
  }));

  const body = {
    items,
    external_reference: order.id,
    notification_url: `${site}/api/webhooks/mercadopago`,
    back_urls: {
      success: `${site}/pay/success?orderId=${order.id}`,
      failure: `${site}/pay/failure?orderId=${order.id}`,
      pending: `${site}/pay/pending?orderId=${order.id}`,
    },
    auto_return: "approved" as const,
  };

  console.log("SITE =", site);
  console.log("BODY =", JSON.stringify(body, null, 2));

  const mpRes = await fetch(
    "https://api.mercadopago.com/checkout/preferences",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  const mpData = await mpRes.json();

  console.log("MP STATUS =", mpRes.status);
  console.log("MP RESPONSE =", JSON.stringify(mpData, null, 2));

  if (!mpRes.ok) {
    console.error("MP preference error", mpData);

    return NextResponse.json(
      {
        ok: false,
        error: "Error creando preferencia.",
        details: mpData,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    preferenceId: mpData.id,
    initPoint: mpData.init_point,
  });
}