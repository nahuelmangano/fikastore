import type { CorreoShipment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { correoArgentinoRequest } from "@/lib/correoArgentino";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";

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

type CorreoImportOrder = Awaited<ReturnType<typeof getCorreoImportOrder>>;
type CorreoShipmentImportOptions = {
  recipientEmail?: string;
};

function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function errorStatus(e: unknown) {
  return typeof e === "object" && e && "status" in e && typeof e.status === "number"
    ? e.status
    : undefined;
}

export async function getCorreoImportOrder(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, correoShipment: true },
  });
}

export async function buildCorreoShipmentPayload(
  order: NonNullable<CorreoImportOrder>,
  options: CorreoShipmentImportOptions = {}
) {
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
    options.recipientEmail ||
    order.user?.email || (await envString("CORREO_ARG_RECIPIENT_EMAIL")) || sender.email;
  const recipientProvince =
    order.shippingProvinceCode ||
    (await envString("CORREO_ARG_RECIPIENT_PROVINCE_CODE")) ||
    sender.originAddress.provinceCode;

  const deliveryType = String(
    order.shippingDeliveryType || (await envString("CORREO_ARG_DELIVERY_TYPE", "D"))
  ).toUpperCase();
  const agency = String(order.shippingBranchCode || (await envString("CORREO_ARG_AGENCY"))).trim();
  if (deliveryType === "S" && !agency) {
    throw new Error("CORREO_ARG_AGENCY requerido para envios a sucursal.");
  }

  return {
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
      agency: deliveryType === "S" ? agency : null,
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
}

export async function importCorreoShipment(
  order: NonNullable<CorreoImportOrder>,
  options: CorreoShipmentImportOptions = {}
) {
  const existingShipment = order.correoShipment;
  const shouldReuse =
    existingShipment &&
    existingShipment.status === "IMPORTED" &&
    existingShipment.shippingId;
  if (shouldReuse) {
    return { ok: true as const, shipment: existingShipment, reused: true };
  }

  const payload = await buildCorreoShipmentPayload(order, options);

  let placeholder: CorreoShipment;
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
  } catch (e: unknown) {
    const code =
      typeof e === "object" && e && "code" in e
        ? e.code
        : typeof e === "object" && e && "meta" in e
          ? (e.meta as { cause?: unknown })?.cause
          : undefined;
    if (code === "P2002") {
      const existing = await prisma.correoShipment.findUnique({ where: { orderId: order.id } });
      return { ok: true as const, shipment: existing, reused: true };
    }
    throw new Error(`No se pudo reservar el envio. ${errorMessage(e)}`);
  }

  try {
    const data = await correoArgentinoRequest<Record<string, unknown>>("/shipping/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const updated = await prisma.correoShipment.update({
      where: { id: placeholder.id },
      data: {
        status: "IMPORTED",
        shippingId: String(data.shippingId || data.trackingNumber || ""),
        lastResponseJson: JSON.stringify(data),
      },
    });

    return { ok: true as const, shipment: updated, reused: false, response: data };
  } catch (e: unknown) {
    await prisma.correoShipment
      .update({
        where: { id: placeholder.id },
        data: {
          status: "ERROR",
          lastResponseJson: JSON.stringify({ error: errorMessage(e) }),
        },
      })
      .catch(() => {});

    const err = new Error(`No se pudo importar el envio. ${errorMessage(e)}`) as Error & {
      status?: number;
    };
    err.status = errorStatus(e) || 502;
    throw err;
  }
}
