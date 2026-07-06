import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { getCorreoImportOrder, importCorreoShipment } from "@/lib/correoShipmentImport";

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

function clean(value: unknown) {
  return String(value || "").trim();
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
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

  if (!name || !phone || !addressLine || !city || !province || !provinceCode || !zip) {
    return badRequest("Completá nombre, teléfono, dirección, ciudad, provincia, código de provincia y CP.");
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
      shippingMethod: "correo",
      shippingAmount: 0,
      notes: `Envio de prueba Correo Argentino creado desde admin/paqueteria por ${user.email || user.id}. Email destinatario: ${email}`,
    },
  });

  const importOrder = await getCorreoImportOrder(order.id);
  if (!importOrder) {
    return NextResponse.json({ ok: false, error: "No se pudo preparar la orden de prueba." }, { status: 500 });
  }

  try {
    const result = await importCorreoShipment(importOrder, { recipientEmail: email });
    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
      },
      shipment: result.shipment,
      reused: result.reused,
      response: result.response,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status =
      typeof e === "object" && e && "status" in e && typeof e.status === "number"
        ? e.status
        : 502;
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
      { status }
    );
  }
}
