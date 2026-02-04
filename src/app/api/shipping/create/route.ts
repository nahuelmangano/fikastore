import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { epickRequest, mapEpickStatus } from "@/lib/epick";

export const runtime = "nodejs";

type Body = {
  orderId: string;
};

function envNumber(name: string, def: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : def;
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const orderId = body?.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId requerido." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: role === "admin" ? { id: orderId } : { id: orderId, userId },
    include: { user: true },
  });
  if (!order) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  const existing = await prisma.ePickShipment.findUnique({ where: { orderId } });
  if (existing?.epickOrderId) {
    return NextResponse.json({ ok: true, shipment: existing, reused: true });
  }
  if (existing && !existing.epickOrderId) {
    return NextResponse.json(
      { ok: false, error: "Envío en proceso. Reintentá en unos segundos." },
      { status: 409 }
    );
  }

  let payload: any;
  try {
    const long = envNumber("EPICK_PKG_LONG", 30);
    const width = envNumber("EPICK_PKG_WIDTH", 20);
    const height = envNumber("EPICK_PKG_HEIGHT", 10);
    const weight = envNumber("EPICK_PKG_WEIGHT", 1);

    payload = {
      info: {
        webhook: requireEnv("EPICK_WEBHOOK_URL"),
      },
      package: {
        long,
        width,
        height,
        weight,
        value: Number(order.total) || 1,
      },
      sender: {
        postal_code: requireEnv("EPICK_SENDER_POSTAL_CODE"),
        name: requireEnv("EPICK_SENDER_NAME"),
        phone: requireEnv("EPICK_SENDER_PHONE"),
        email: requireEnv("EPICK_SENDER_EMAIL"),
        street: requireEnv("EPICK_SENDER_STREET"),
        number: requireEnv("EPICK_SENDER_NUMBER"),
        city: requireEnv("EPICK_SENDER_CITY"),
        province: requireEnv("EPICK_SENDER_PROVINCE"),
        extra: process.env.EPICK_SENDER_EXTRA || "",
        info: process.env.EPICK_SENDER_INFO || "",
      },
      addressee: {
        postal_code: order.shippingZip,
        name: order.shippingName,
        phone: order.shippingPhone,
        email: order.user?.email || requireEnv("EPICK_SENDER_EMAIL"),
        street: order.shippingAddressLine,
        number: order.shippingAddressLine,
        city: order.shippingCity,
        province: process.env.EPICK_ADDRESSEE_PROVINCE || order.shippingCity,
        extra: "",
        info: "",
      },
    };
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }

  let placeholder: any;
  try {
    placeholder = await prisma.ePickShipment.create({
      data: {
        orderId: order.id,
        status: "PENDING",
      },
    });
  } catch (e: any) {
    const code = e?.code || e?.meta?.cause;
    if (code === "P2002") {
      const existingNow = await prisma.ePickShipment.findUnique({ where: { orderId } });
      return NextResponse.json({ ok: true, shipment: existingNow, reused: true });
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo reservar el envío.", details: String(e?.message || e) },
      { status: 500 }
    );
  }

  try {
    const data = await epickRequest<any>("/api/orders/integrations/confirm-order", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const shipment = await prisma.ePickShipment.update({
      where: { id: placeholder.id },
      data: {
        epickOrderId: String(data?.id || data?.order_id || ""),
        senderCode: String(data?.sender_code || data?.senderCode || ""),
        status: mapEpickStatus(data?.status_name || data?.status),
        mpUrl: data?.mp_url ? String(data.mp_url) : undefined,
        choUrl: data?.cho_url ? String(data.cho_url) : undefined,
        preferenceId: data?.preference_id ? String(data.preference_id) : undefined,
        qrImage: data?.qr_image ? String(data.qr_image) : undefined,
        lastPayloadJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ ok: true, shipment, reused: false });
  } catch (e: any) {
    await prisma.ePickShipment.delete({ where: { id: placeholder.id } }).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "No se pudo crear el envío.", details: String(e?.message || e) },
      { status: 502 }
    );
  }
}
