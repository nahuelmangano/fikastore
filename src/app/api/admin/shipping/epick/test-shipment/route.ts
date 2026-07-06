import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { epickRequest, mapEpickStatus, splitEpickAddressLine } from "@/lib/epick";
import { isAdminRole } from "@/lib/roles";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";

export const runtime = "nodejs";

type TestShipmentBody = {
  name?: string;
  phone?: string;
  email?: string;
  addressLine?: string;
  city?: string;
  province?: string;
  provinceCode?: string;
  zip?: string;
  declaredValue?: number | string;
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

function clean(value: unknown) {
  return String(value || "").trim();
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

async function configNumber(name: string, def: number) {
  const v = Number(await getProviderConfigValue("epick", name, String(def)));
  return Number.isFinite(v) && v > 0 ? v : def;
}

async function requireConfig(name: string) {
  const v = await getProviderConfigValue("epick", name);
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; email?: string | null } | undefined;

  if (!isAdminRole(user?.role)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Sesión inválida." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as TestShipmentBody | null;
  if (!body) return badRequest("Payload inválido.");

  const name = clean(body.name);
  const phone = clean(body.phone);
  const email = clean(body.email) || user.email || "";
  const addressLine = clean(body.addressLine);
  const city = clean(body.city);
  const province = clean(body.province);
  const provinceCode = clean(body.provinceCode).toUpperCase();
  const zip = clean(body.zip);
  const declaredValue = Number(body.declaredValue || 1000);

  if (!name || !phone || !addressLine || !city || !province || !zip) {
    return badRequest("Completá nombre, teléfono, dirección, ciudad, provincia y CP.");
  }

  if (!Number.isFinite(declaredValue) || declaredValue <= 0) {
    return badRequest("El valor declarado debe ser mayor a cero.");
  }

  const order = await prisma.order.create({
    data: {
      userId: user.id,
      status: "paid",
      total: declaredValue,
      shippingName: name,
      shippingPhone: phone,
      shippingAddressLine: addressLine,
      shippingCity: city,
      shippingZip: zip,
      shippingProvince: province,
      shippingProvinceCode: provinceCode,
      shippingMethod: "epick",
      shippingAmount: 0,
      notes: `Envio de prueba E-pick creado desde admin/paqueteria por ${user.email || user.id}. Email destinatario: ${email}`,
    },
  });

  let payload: unknown;
  try {
    const addresseeAddress = splitEpickAddressLine(addressLine);

    payload = {
      info: {
        webhook: await requireConfig("EPICK_WEBHOOK_URL"),
      },
      package: {
        long: await configNumber("EPICK_PKG_LONG", 30),
        width: await configNumber("EPICK_PKG_WIDTH", 20),
        height: await configNumber("EPICK_PKG_HEIGHT", 10),
        weight: await configNumber("EPICK_PKG_WEIGHT", 1),
        value: declaredValue,
      },
      sender: {
        postal_code: await requireConfig("EPICK_SENDER_POSTAL_CODE"),
        name: await requireConfig("EPICK_SENDER_NAME"),
        phone: await requireConfig("EPICK_SENDER_PHONE"),
        email: await requireConfig("EPICK_SENDER_EMAIL"),
        street: await requireConfig("EPICK_SENDER_STREET"),
        number: await requireConfig("EPICK_SENDER_NUMBER"),
        city: await requireConfig("EPICK_SENDER_CITY"),
        province: await requireConfig("EPICK_SENDER_PROVINCE"),
        extra: await getProviderConfigValue("epick", "EPICK_SENDER_EXTRA"),
        info: await getProviderConfigValue("epick", "EPICK_SENDER_INFO"),
      },
      addressee: {
        postal_code: zip,
        name,
        phone,
        email: email || (await requireConfig("EPICK_SENDER_EMAIL")),
        street: addresseeAddress.street,
        number: addresseeAddress.number,
        city,
        province: (await getProviderConfigValue("epick", "EPICK_ADDRESSEE_PROVINCE")) || province,
        extra: "",
        info: "",
      },
    };
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
        },
      },
      { status: 500 }
    );
  }

  const placeholder = await prisma.ePickShipment.create({
    data: {
      orderId: order.id,
      status: "PENDING",
    },
  });

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

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
      },
      shipment,
      reused: false,
      response: data,
    });
  } catch (e: unknown) {
    await prisma.ePickShipment.delete({ where: { id: placeholder.id } }).catch(() => {});
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo crear el envío de prueba.",
        details: message,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
        },
      },
      { status: 502 }
    );
  }
}
