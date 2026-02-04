import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { epickRequest } from "@/lib/epick";

export const runtime = "nodejs";

type Body = {
  orderId?: string;
  postalCode?: string;
};

function envNumber(name: string, def: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const orderId = body?.orderId?.trim();
  const postalCode = body?.postalCode?.trim();

  if (!orderId && !postalCode) {
    return NextResponse.json({ ok: false, error: "orderId o postalCode requeridos." }, { status: 400 });
  }

  let value = 0;
  let zip = postalCode || "";

  if (orderId) {
    const order = await prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) {
      return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
    }
    value = Number(order.total);
    if (!zip) zip = order.shippingZip;
  }

  if (!zip) {
    return NextResponse.json({ ok: false, error: "Código postal inválido." }, { status: 400 });
  }

  const long = envNumber("EPICK_PKG_LONG", 30);
  const width = envNumber("EPICK_PKG_WIDTH", 20);
  const height = envNumber("EPICK_PKG_HEIGHT", 10);
  const weight = envNumber("EPICK_PKG_WEIGHT", 1);

  const senderPostal = process.env.EPICK_SENDER_POSTAL_CODE;
  if (!senderPostal) {
    return NextResponse.json(
      { ok: false, error: "EPICK_SENDER_POSTAL_CODE no configurado." },
      { status: 500 }
    );
  }

  const payload = {
    package: { long, width, height, weight, value: value || 1 },
    sender: { postal_code: senderPostal },
    addressee: { postal_code: zip },
  };

  try {
    const data = await epickRequest<any>("/api/orders/calculator/www", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return NextResponse.json({ ok: true, quote: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "No se pudo cotizar envío.", details: String(e?.message || e) },
      { status: 502 }
    );
  }
}
