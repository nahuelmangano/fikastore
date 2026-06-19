import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { correoArgentinoRequest } from "@/lib/correoArgentino";
import { isStaffRole } from "@/lib/roles";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";

export const runtime = "nodejs";

async function requireEnv(name: string) {
  const v = await getProviderConfigValue("correo", name);
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

async function envString(name: string, def = "") {
  const v = await getProviderConfigValue("correo", name);
  return v ? String(v) : def;
}

async function envInt(name: string, def: number) {
  const v = Number(await getProviderConfigValue("correo", name, String(def)));
  return Number.isFinite(v) && v > 0 ? Math.round(v) : def;
}

function clampDim(n: number) {
  return Math.min(150, Math.max(1, Math.round(n)));
}

function splitAddress(line: string) {
  const trimmed = String(line || "").trim();
  const match = trimmed.match(/^(.*?)(?:\s+(\d+))\s*$/);
  if (!match) return { streetName: trimmed || "Sin calle", streetNumber: "0" };
  const streetName = match[1].trim() || "Sin calle";
  const streetNumber = match[2] || "0";
  return { streetName, streetNumber };
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { user: true, correoShipment: true },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "paid" && order.status !== "shipped") {
    return NextResponse.json(
      { ok: false, error: "Solo se puede importar un envío de un pedido pagado." },
      { status: 400 }
    );
  }

  const existingShipment = order.correoShipment;
  const shouldReuse =
    existingShipment &&
    existingShipment.status === "IMPORTED" &&
    existingShipment.shippingId;
  if (shouldReuse) {
    return NextResponse.json({ ok: true, shipment: existingShipment, reused: true });
  }

  let payload: any;
  try {
    const weight = Math.min(25000, await envInt("CORREO_ARG_PKG_WEIGHT_G", 1000));
    const height = clampDim(await envInt("CORREO_ARG_PKG_HEIGHT_CM", 10));
    const width = clampDim(await envInt("CORREO_ARG_PKG_WIDTH_CM", 20));
    const length = clampDim(await envInt("CORREO_ARG_PKG_LENGTH_CM", 30));

    const sender = {
      name: await requireEnv("CORREO_ARG_SENDER_NAME"),
      phone: await requireEnv("CORREO_ARG_SENDER_PHONE"),
      cellPhone: await envString("CORREO_ARG_SENDER_CELLPHONE"),
      email: await requireEnv("CORREO_ARG_SENDER_EMAIL"),
      originAddress: {
        streetName: await requireEnv("CORREO_ARG_SENDER_STREET"),
        streetNumber: await requireEnv("CORREO_ARG_SENDER_NUMBER"),
        floor: await envString("CORREO_ARG_SENDER_FLOOR"),
        apartment: await envString("CORREO_ARG_SENDER_APARTMENT"),
        city: await requireEnv("CORREO_ARG_SENDER_CITY"),
        provinceCode: await requireEnv("CORREO_ARG_SENDER_PROVINCE_CODE"),
        postalCode: await requireEnv("CORREO_ARG_SENDER_POSTAL_CODE"),
      },
    };

    const { streetName, streetNumber } = splitAddress(order.shippingAddressLine);
    const recipientEmail =
      order.user?.email || (await envString("CORREO_ARG_RECIPIENT_EMAIL")) || sender.email;
    const recipientProvince =
      order.shippingProvinceCode ||
      (await envString("CORREO_ARG_RECIPIENT_PROVINCE_CODE")) ||
      sender.originAddress.provinceCode;

    const deliveryType = (await envString("CORREO_ARG_DELIVERY_TYPE", "D")).toUpperCase();
    if (deliveryType === "S" && !(await envString("CORREO_ARG_AGENCY"))) {
      throw new Error("CORREO_ARG_AGENCY requerido para envíos a sucursal.");
    }

    payload = {
      customerId: await requireEnv("CORREO_ARG_CUSTOMER_ID"),
      extOrderId: order.id,
      orderNumber: order.orderNumber || undefined,
      sender,
      recipient: {
        name: order.shippingName,
        phone: order.shippingPhone || "",
        cellPhone: "",
        email: recipientEmail,
      },
      shipping: {
        deliveryType,
        agency: deliveryType === "S" ? await envString("CORREO_ARG_AGENCY") : null,
        address: {
          streetName,
          streetNumber,
          floor: "",
          apartment: "",
          city: order.shippingCity,
          provinceCode: recipientProvince,
          postalCode: order.shippingZip,
        },
        productType: await envString("CORREO_ARG_PRODUCT_TYPE", "CP"),
        weight,
        declaredValue: Number(order.total) || 1,
        height,
        length,
        width,
      },
    };
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }

  let placeholder: any;
  try {
    if (existingShipment?.id) {
      placeholder = await prisma.correoShipment.update({
        where: { id: existingShipment.id },
        data: {
          status: "IMPORTING",
          lastPayloadJson: JSON.stringify(payload),
        },
      });
    } else {
      placeholder = await prisma.correoShipment.create({
        data: {
          orderId: order.id,
          status: "IMPORTING",
          lastPayloadJson: JSON.stringify(payload),
        },
      });
    }
  } catch (e: any) {
    const code = e?.code || e?.meta?.cause;
    if (code === "P2002") {
      const existing = await prisma.correoShipment.findUnique({ where: { orderId: order.id } });
      return NextResponse.json({ ok: true, shipment: existing, reused: true });
    }
    return NextResponse.json(
      { ok: false, error: "No se pudo reservar el envío.", details: String(e?.message || e) },
      { status: 500 }
    );
  }

  try {
    const data = await correoArgentinoRequest<any>("/shipping/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const updated = await prisma.correoShipment.update({
      where: { id: placeholder.id },
      data: {
        status: "IMPORTED",
        shippingId: String(data?.shippingId || data?.trackingNumber || ""),
        lastResponseJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ ok: true, shipment: updated, reused: false });
  } catch (e: any) {
    await prisma.correoShipment.update({
      where: { id: placeholder.id },
      data: {
        status: "ERROR",
        lastResponseJson: JSON.stringify({ error: String(e?.message || e) }),
      },
    }).catch(() => {});

    return NextResponse.json(
      { ok: false, error: "No se pudo importar el envío.", details: String(e?.message || e) },
      { status: 502 }
    );
  }
}
