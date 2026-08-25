import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/publicUrl";
import { getResolvedMercadoPagoAccessToken } from "@/lib/storeSettings";
import { getOrderContactEmail, normalizeOrderEmail } from "@/lib/orderAccess";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  return publicBaseUrl(req);
}

function canUseAutoReturn(site: string) {
  try {
    return new URL(site).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const { orderId, email } = await req.json().catch(() => ({}));
  const accessEmail = normalizeOrderEmail(email);

  if (!orderId || typeof orderId !== "string") {
    return NextResponse.json(
      { ok: false, error: "orderId inválido." },
      { status: 400 }
    );
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: {
      user: { select: { email: true } },
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  const canAccess = order
    ? isStaffRole(role) || (userId && order.userId === userId) || (accessEmail && getOrderContactEmail(order) === accessEmail)
    : false;

  if (!order || !canAccess) {
    return NextResponse.json(
      { ok: false, error: "Orden no encontrada." },
      { status: 404 }
    );
  }

  const latestPayment = order.payments[0];
  if (latestPayment?.provider && latestPayment.provider !== "mercadopago") {
    return NextResponse.json(
      { ok: false, error: "Este pedido fue creado con otro medio de pago." },
      { status: 409 },
    );
  }

  const token = await getResolvedMercadoPagoAccessToken();

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

  const body: {
    items: typeof items;
    external_reference: string;
    notification_url: string;
    back_urls: {
      success: string;
      failure: string;
      pending: string;
    };
    auto_return?: "approved";
  } = {
    items,
    external_reference: order.id,
    notification_url: `${site}/api/webhooks/mercadopago`,
    back_urls: {
      success: `${site}/pay/success?orderId=${order.id}${accessEmail ? `&email=${encodeURIComponent(accessEmail)}` : ""}`,
      failure: `${site}/pay/failure?orderId=${order.id}${accessEmail ? `&email=${encodeURIComponent(accessEmail)}` : ""}`,
      pending: `${site}/pay/pending?orderId=${order.id}${accessEmail ? `&email=${encodeURIComponent(accessEmail)}` : ""}`,
    },
  };

  if (canUseAutoReturn(site)) {
    body.auto_return = "approved";
  } else {
    console.warn(
      "MP auto_return disabled: Mercado Pago requires an HTTPS public URL.",
      { site }
    );
  }

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
