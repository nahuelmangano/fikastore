import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createCustomShippingCarrier,
  getShippingCarriers,
  isMissingVisibleToMerchantError,
  isCustomShippingCarrierKey,
  setCustomShippingCarrierSettings,
  type ShippingCarrierKey,
} from "@/lib/shippingCarriers";
import { isAdminRole, isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
}

function isValidKey(k: string): k is ShippingCarrierKey {
  return k === "epick" || k === "andreani" || k === "correo" || k === "pickup";
}

function canTargetCarrierKey(key: string) {
  return isValidKey(key) || isCustomShippingCarrierKey(key);
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return deny();

  const isAdmin = isAdminRole(role);
  const carriers = await getShippingCarriers({ visibleToMerchantOnly: !isAdmin });
  return NextResponse.json({
    ok: true,
    carriers: carriers.map((c) => ({
      key: c.key,
      name: c.name,
      enabled: c.enabled,
      visibleToMerchant: c.visibleToMerchant,
      custom: c.custom,
      description: c.description,
      flatRate: c.flatRate,
      pricingMode: c.pricingMode,
      deliveryDays: c.deliveryDays,
      shippingSurcharge: c.shippingSurcharge,
      freeShippingMinimumSubtotal: c.freeShippingMinimumSubtotal,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return deny();

  const body = (await req.json().catch(() => null)) as {
    name?: string;
    description?: string;
    flatRate?: number;
    pricingMode?: "fixed" | "agreement" | "free";
    deliveryDays?: string;
    shippingSurcharge?: number;
    freeShippingMinimumSubtotal?: number;
  } | null;

  try {
    const carrier = await createCustomShippingCarrier({
      name: String(body?.name || ""),
      description: String(body?.description || ""),
      flatRate: Number(body?.flatRate || 0),
      pricingMode: body?.pricingMode === "agreement" ? "agreement" : body?.pricingMode === "free" ? "free" : "fixed",
    });
    return NextResponse.json({ ok: true, carrier });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo crear el método." },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return deny();

  const isAdmin = isAdminRole(role);
  const body = (await req.json().catch(() => null)) as {
    key?: string;
    enabled?: boolean;
    visibleToMerchant?: boolean;
    name?: string;
    description?: string;
    flatRate?: number;
    pricingMode?: "fixed" | "agreement" | "free";
    deliveryDays?: string;
    shippingSurcharge?: number;
    freeShippingMinimumSubtotal?: number;
  } | null;
  const key = String(body?.key || "").trim();
  const enabled = body?.enabled;
  const visibleToMerchant = body?.visibleToMerchant;
  const name = body?.name;
  const description = body?.description;
  const flatRate = body?.flatRate;
  const pricingMode = body?.pricingMode;
  const deliveryDays = body?.deliveryDays;
  const shippingSurcharge = body?.shippingSurcharge;
  const freeShippingMinimumSubtotal = body?.freeShippingMinimumSubtotal;

  if (
    !canTargetCarrierKey(key) ||
    (typeof enabled !== "boolean" &&
      typeof visibleToMerchant !== "boolean" &&
      typeof name !== "string" &&
      typeof description !== "string" &&
      typeof flatRate !== "number" &&
      typeof shippingSurcharge !== "number" &&
      typeof freeShippingMinimumSubtotal !== "number" &&
      typeof deliveryDays !== "string" &&
      pricingMode !== "fixed" &&
      pricingMode !== "agreement" &&
      pricingMode !== "free")
  ) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  if (typeof visibleToMerchant === "boolean" && !isAdmin) {
    return NextResponse.json({ ok: false, error: "Solo un admin puede cambiar la visibilidad para merchants." }, { status: 403 });
  }

  const carriers = await getShippingCarriers();
  const found = carriers.find((c) => c.key === key);
  if (!found) {
    return NextResponse.json({ ok: false, error: "Carrier inexistente." }, { status: 404 });
  }

  if (!isAdmin && !found.visibleToMerchant) {
    return NextResponse.json({ ok: false, error: "Método no disponible para merchant." }, { status: 403 });
  }

  if ((typeof description === "string" || typeof flatRate === "number") && !found.custom) {
    return NextResponse.json({ ok: false, error: "Solo se puede editar precio y descripción en métodos personalizados." }, { status: 400 });
  }

  if (typeof deliveryDays === "string" && !/^(\d+)(\s*-\s*\d+)?$/.test(deliveryDays.trim())) {
    return NextResponse.json({ ok: false, error: "Ingresá un día o rango válido, por ejemplo 3-6." }, { status: 400 });
  }

  if (typeof shippingSurcharge === "number" && (!Number.isFinite(shippingSurcharge) || shippingSurcharge < 0)) {
    return NextResponse.json({ ok: false, error: "Ingresá un recargo válido mayor o igual a 0." }, { status: 400 });
  }

  if (
    typeof freeShippingMinimumSubtotal === "number" &&
    (!Number.isFinite(freeShippingMinimumSubtotal) || freeShippingMinimumSubtotal < 0)
  ) {
    return NextResponse.json({ ok: false, error: "Ingresá un monto mínimo válido mayor o igual a 0." }, { status: 400 });
  }

  if (typeof deliveryDays === "string") {
    await prisma.shippingProviderSetting.upsert({
      where: { provider_key: { provider: key, key: "DELIVERY_DAYS" } },
      create: { provider: key, key: "DELIVERY_DAYS", value: deliveryDays.trim(), isSecret: false },
      update: { value: deliveryDays.trim(), isSecret: false },
    });
  }

  if (typeof shippingSurcharge === "number") {
    await prisma.shippingProviderSetting.upsert({
      where: { provider_key: { provider: key, key: "SHIPPING_SURCHARGE" } },
      create: { provider: key, key: "SHIPPING_SURCHARGE", value: String(Math.round(shippingSurcharge * 100) / 100), isSecret: false },
      update: { value: String(Math.round(shippingSurcharge * 100) / 100), isSecret: false },
    });
  }

  if (typeof freeShippingMinimumSubtotal === "number") {
    await prisma.shippingProviderSetting.upsert({
      where: { provider_key: { provider: key, key: "FREE_SHIPPING_MIN_SUBTOTAL" } },
      create: {
        provider: key,
        key: "FREE_SHIPPING_MIN_SUBTOTAL",
        value: String(Math.round(freeShippingMinimumSubtotal * 100) / 100),
        isSecret: false,
      },
      update: { value: String(Math.round(freeShippingMinimumSubtotal * 100) / 100), isSecret: false },
    });
  }

  let updated: { key: string; name: string; enabled: boolean };
  try {
    updated = await prisma.shippingCarrier.update({
      where: { key },
      data: {
        ...(typeof enabled === "boolean" ? { enabled } : {}),
        ...(typeof visibleToMerchant === "boolean" ? { visibleToMerchant } : {}),
        ...(found.custom && typeof name === "string" && name.trim() ? { name: name.trim().slice(0, 80) } : {}),
      },
      select: { key: true, name: true, enabled: true },
    });
  } catch (error) {
    if (!isMissingVisibleToMerchantError(error) || typeof visibleToMerchant !== "boolean") throw error;
    return NextResponse.json(
      {
        ok: false,
        error: "Falta aplicar la migración de visibilidad de paquetería para guardar este cambio.",
      },
      { status: 409 },
    );
  }

  if (
    found.custom &&
    (typeof description === "string" ||
      typeof flatRate === "number" ||
      pricingMode === "fixed" ||
      pricingMode === "agreement" ||
      pricingMode === "free")
  ) {
    await setCustomShippingCarrierSettings(key, {
      description: typeof description === "string" ? description : found.description,
      flatRate: typeof flatRate === "number" ? flatRate : found.flatRate,
      pricingMode: pricingMode === "fixed" || pricingMode === "agreement" || pricingMode === "free" ? pricingMode : found.pricingMode,
    });
  }

  const refreshedCarriers = await getShippingCarriers();
  const refreshed = refreshedCarriers.find((carrier) => carrier.key === key);

  return NextResponse.json({
    ok: true,
    carrier: refreshed || {
      key: updated.key,
      name: updated.name,
      enabled: updated.enabled,
      visibleToMerchant: found.visibleToMerchant,
      custom: found.custom,
      description: found.description,
      flatRate: found.flatRate,
      pricingMode: found.pricingMode,
      shippingSurcharge: found.shippingSurcharge,
      freeShippingMinimumSubtotal: found.freeShippingMinimumSubtotal,
    },
  });
}
