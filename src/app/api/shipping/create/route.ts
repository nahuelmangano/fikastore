import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { epickRequest, mapEpickStatus, splitEpickAddressLine } from "@/lib/epick";
import { getOrderContactEmail, normalizeOrderEmail } from "@/lib/orderAccess";
import { isStaffRole } from "@/lib/roles";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";

export const runtime = "nodejs";

type Body = {
  orderId: string;
  email?: string;
};

type SessionUser = {
  id?: string;
  role?: string;
};

type EpickCreatePayload = {
  info: {
    webhook: string;
  };
  package: {
    long: number;
    width: number;
    height: number;
    weight: number;
    value: number;
  };
  sender: {
    postal_code: string;
    name: string;
    phone: string;
    email: string;
    street: string;
    number: string;
    city: string;
    province: string;
    extra: string | null;
    info: string | null;
  };
  addressee: {
    postal_code: string;
    name: string;
    phone: string;
    email: string;
    street: string;
    number: string;
    city: string;
    province: string;
    extra: string;
    info: string;
  };
};

type EpickCreateResponse = {
  id?: unknown;
  order_id?: unknown;
  sender_code?: unknown;
  senderCode?: unknown;
  status_name?: unknown;
  status?: unknown;
  mp_url?: unknown;
  cho_url?: unknown;
  preference_id?: unknown;
  qr_image?: unknown;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function envNumber(name: string, def: number) {
  const v = Number(await getProviderConfigValue("epick", name, String(def)));
  return Number.isFinite(v) && v > 0 ? v : def;
}

async function requireEnv(name: string) {
  const v = await getProviderConfigValue("epick", name);
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  const userId = user?.id;
  const role = user?.role;

  const body = (await req.json().catch(() => null)) as Body | null;
  const orderId = body?.orderId?.trim();
  const accessEmail = normalizeOrderEmail(body?.email);
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId requerido." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: { user: true },
  });
  const canAccess = order
    ? isStaffRole(role) || (userId && order.userId === userId) || (accessEmail && getOrderContactEmail(order) === accessEmail)
    : false;
  if (!order || !canAccess) {
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

  let payload: EpickCreatePayload;
  try {
    const long = await envNumber("EPICK_PKG_LONG", 30);
    const width = await envNumber("EPICK_PKG_WIDTH", 20);
    const height = await envNumber("EPICK_PKG_HEIGHT", 10);
    const weight = await envNumber("EPICK_PKG_WEIGHT", 1);
    const addresseeAddress = splitEpickAddressLine(order.shippingAddressLine);

    payload = {
      info: {
        webhook: await requireEnv("EPICK_WEBHOOK_URL"),
      },
      package: {
        long,
        width,
        height,
        weight,
        value: Number(order.total) || 1,
      },
      sender: {
        postal_code: await requireEnv("EPICK_SENDER_POSTAL_CODE"),
        name: await requireEnv("EPICK_SENDER_NAME"),
        phone: await requireEnv("EPICK_SENDER_PHONE"),
        email: await requireEnv("EPICK_SENDER_EMAIL"),
        street: await requireEnv("EPICK_SENDER_STREET"),
        number: await requireEnv("EPICK_SENDER_NUMBER"),
        city: await requireEnv("EPICK_SENDER_CITY"),
        province: await requireEnv("EPICK_SENDER_PROVINCE"),
        extra: await getProviderConfigValue("epick", "EPICK_SENDER_EXTRA"),
        info: await getProviderConfigValue("epick", "EPICK_SENDER_INFO"),
      },
      addressee: {
        postal_code: order.shippingZip,
        name: order.shippingName,
        phone: order.shippingPhone,
        email: order.contactEmail || order.user?.email || (await requireEnv("EPICK_SENDER_EMAIL")),
        street: addresseeAddress.street,
        number: addresseeAddress.number,
        city: order.shippingCity,
        province: (await getProviderConfigValue("epick", "EPICK_ADDRESSEE_PROVINCE")) || order.shippingProvince,
        extra: "",
        info: "",
      },
    };
  } catch (error: unknown) {
    return NextResponse.json({ ok: false, error: errorMessage(error) }, { status: 500 });
  }

  let placeholder: Awaited<ReturnType<typeof prisma.ePickShipment.create>>;
  try {
    placeholder = await prisma.ePickShipment.create({
      data: {
        orderId: order.id,
        status: "PENDING",
      },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string; meta?: { cause?: string } };
    const code = prismaError.code || prismaError.meta?.cause;
    if (code === "P2002") {
      const existingNow = await prisma.ePickShipment.findUnique({ where: { orderId } });
      return NextResponse.json({ ok: true, shipment: existingNow, reused: true });
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo reservar el envío.", details: errorMessage(error) },
      { status: 500 }
    );
  }

  try {
    const data = await epickRequest<EpickCreateResponse>("/api/orders/integrations/confirm-order", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const shipment = await prisma.ePickShipment.update({
      where: { id: placeholder.id },
      data: {
        epickOrderId: String(data?.id || data?.order_id || ""),
        senderCode: String(data?.sender_code || data?.senderCode || ""),
        status: mapEpickStatus(String(data?.status_name || data?.status || "")),
        mpUrl: data?.mp_url ? String(data.mp_url) : undefined,
        choUrl: data?.cho_url ? String(data.cho_url) : undefined,
        preferenceId: data?.preference_id ? String(data.preference_id) : undefined,
        qrImage: data?.qr_image ? String(data.qr_image) : undefined,
        lastPayloadJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ ok: true, shipment, reused: false });
  } catch (error: unknown) {
    await prisma.ePickShipment.delete({ where: { id: placeholder.id } }).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "No se pudo crear el envío.", details: errorMessage(error) },
      { status: 502 }
    );
  }
}
