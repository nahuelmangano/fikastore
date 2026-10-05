import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export type ShippingCarrierKey = "epick" | "andreani" | "correo" | "pickup";
export type ShippingDeliveryTypeKey = "D" | "S";
export type ShippingCarrierView = {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  visibleToMerchant: boolean;
  custom: boolean;
  description: string;
  flatRate: number;
  pricingMode: "fixed" | "agreement" | "free";
  deliveryDays: string | null;
  shippingSurcharge: number;
  freeShippingMinimumSubtotal: number;
  freeShippingMinimumDeliveryTypes: ShippingDeliveryTypeKey[];
  pickupPoints: ShippingPickupPoint[];
};
export type ShippingPickupPoint = {
  id: string;
  name: string;
  notes: string;
};

const CUSTOM_SHIPPING_PROVIDER = "custom_shipping";

const DEFAULT_CARRIERS: { key: ShippingCarrierKey; name: string; enabled: boolean; visibleToMerchant: boolean }[] = [
  { key: "epick", name: "E-pick", enabled: true, visibleToMerchant: true },
  { key: "andreani", name: "Andreani", enabled: false, visibleToMerchant: false },
  { key: "correo", name: "Correo Argentino", enabled: true, visibleToMerchant: true },
  { key: "pickup", name: "Punto de Retiro", enabled: false, visibleToMerchant: false },
];

function orderByDefault(a: { key: string }, b: { key: string }) {
  const order = new Map(DEFAULT_CARRIERS.map((c, i) => [c.key, i]));
  const ai = order.get(a.key as ShippingCarrierKey) ?? 999;
  const bi = order.get(b.key as ShippingCarrierKey) ?? 999;
  if (ai !== bi) return ai - bi;
  return a.key.localeCompare(b.key);
}

function defaultVisibilityForKey(key: string) {
  return DEFAULT_CARRIERS.find((carrier) => carrier.key === key)?.visibleToMerchant ?? true;
}

export function isMissingVisibleToMerchantError(error: unknown) {
  const prismaError = error as { message?: string; meta?: { cause?: string } };
  const message = [
    error instanceof Error ? error.message : String(error),
    prismaError.message,
    prismaError.meta?.cause,
  ]
    .filter(Boolean)
    .join(" ");

  return message.includes("visibleToMerchant");
}

export function isCustomShippingCarrierKey(key: string) {
  return key.startsWith("custom-");
}

async function setCarrierVisibilityIfSupported(key: string, visibleToMerchant: boolean) {
  try {
    await prisma.shippingCarrier.update({
      where: { key },
      data: { visibleToMerchant },
      select: { key: true },
    });
  } catch (error) {
    if (!isMissingVisibleToMerchantError(error)) throw error;
  }
}

async function updateCarrierBase(key: string, data: { name?: string; enabled?: boolean; visibleToMerchant?: boolean }) {
  try {
    await prisma.shippingCarrier.update({
      where: { key },
      data,
      select: { key: true },
    });
  } catch (error) {
    if (!isMissingVisibleToMerchantError(error) || typeof data.visibleToMerchant !== "boolean") throw error;

    await prisma.shippingCarrier.update({
      where: { key },
      data: {
        ...(typeof data.name === "string" ? { name: data.name } : {}),
        ...(typeof data.enabled === "boolean" ? { enabled: data.enabled } : {}),
      },
      select: { key: true },
    });
  }
}

async function reconcileShippingCarrierDefaults(carriers: ShippingCarrierView[]) {
  const pickup = carriers.find((carrier) => carrier.key === "pickup");
  if (pickup && (pickup.name !== "Punto de Retiro" || pickup.enabled || pickup.visibleToMerchant)) {
    await updateCarrierBase("pickup", { name: "Punto de Retiro", enabled: false, visibleToMerchant: false });
  }

  const legacyAgreementCarrier = carriers.find(
    (carrier) =>
      carrier.key === "custom-acordar-envio" ||
      carrier.name.trim().toLowerCase() === "acordar envio" ||
      carrier.name.trim().toLowerCase() === "acordar envío",
  );

  if (legacyAgreementCarrier && legacyAgreementCarrier.name !== "Punto de Retiro") {
    await updateCarrierBase(legacyAgreementCarrier.key, { name: "Punto de Retiro" });
  }
}

async function createCarrierBase(input: { key: string; name: string; enabled: boolean }) {
  try {
    return await prisma.shippingCarrier.create({
      data: {
        key: input.key,
        name: input.name,
        enabled: input.enabled,
      },
      select: { key: true },
    });
  } catch (error) {
    if (!isMissingVisibleToMerchantError(error)) throw error;

    await prisma.$executeRaw`
      INSERT INTO [dbo].[ShippingCarrier] ([id], [key], [name], [enabled], [updatedAt])
      VALUES (${crypto.randomUUID()}, ${input.key}, ${input.name}, ${input.enabled}, CURRENT_TIMESTAMP)
    `;

    return { key: input.key };
  }
}

function slugifyCustomCarrierName(name: string) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function customSettingKey(carrierKey: string, field: "description" | "flatRate" | "pricingMode" | "pickupPoints") {
  return `${carrierKey}:${field}`;
}

function normalizePickupPoints(value: unknown): ShippingPickupPoint[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const raw = item && typeof item === "object" ? item as Partial<ShippingPickupPoint> : {};
      const name = String(raw.name || "").trim().slice(0, 80);
      if (!name) return null;
      return {
        id: String(raw.id || `point-${index + 1}`).trim().slice(0, 80),
        name,
        notes: String(raw.notes || "").trim().slice(0, 180),
      };
    })
    .filter((item): item is ShippingPickupPoint => Boolean(item));
}

function parsePickupPoints(value?: string | null) {
  if (!value) return [];
  try {
    return normalizePickupPoints(JSON.parse(value));
  } catch {
    return [];
  }
}

async function deliveryDaysForCarrier(key: string) {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: { provider_key: { provider: key, key: "DELIVERY_DAYS" } },
    select: { value: true },
  });
  const value = String(row?.value || "").trim();
  if (/^(\d+)(\s*-\s*\d+)?$/.test(value)) return value;
  return key === "epick" ? "2-3" : key === "correo" ? "3-6" : null;
}

async function shippingSurchargeForCarrier(key: string) {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: { provider_key: { provider: key, key: "SHIPPING_SURCHARGE" } },
    select: { value: true },
  });
  const value = Number(String(row?.value || "").trim());
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function freeShippingMinimumSubtotalForCarrier(key: string) {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: { provider_key: { provider: key, key: "FREE_SHIPPING_MIN_SUBTOTAL" } },
    select: { value: true },
  });
  const value = Number(String(row?.value || "").trim());
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function parseDeliveryTypes(value?: string | null): ShippingDeliveryTypeKey[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ShippingDeliveryTypeKey => item === "D" || item === "S");
  } catch {
    return [];
  }
}

async function freeShippingMinimumDeliveryTypesForCarrier(key: string) {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: { provider_key: { provider: key, key: "FREE_SHIPPING_MIN_DELIVERY_TYPES" } },
    select: { value: true },
  });
  return parseDeliveryTypes(row?.value);
}

async function customCarrierSettingsMap() {
  const rows = await prisma.shippingProviderSetting.findMany({
    where: { provider: CUSTOM_SHIPPING_PROVIDER },
    select: { key: true, value: true },
  });
  return new Map(rows.map((row) => [row.key, row.value]));
}

async function withCustomCarrierSettings(
  carriers: Omit<
    ShippingCarrierView,
    | "custom"
    | "description"
    | "flatRate"
    | "pricingMode"
    | "deliveryDays"
    | "shippingSurcharge"
    | "freeShippingMinimumSubtotal"
    | "freeShippingMinimumDeliveryTypes"
    | "pickupPoints"
  >[],
): Promise<ShippingCarrierView[]> {
  const settings = await customCarrierSettingsMap();
  return Promise.all(carriers.map(async (carrier) => {
    const custom = isCustomShippingCarrierKey(carrier.key);
    const rawRate = Number(settings.get(customSettingKey(carrier.key, "flatRate")) || 0);
    const rawPricingMode = String(settings.get(customSettingKey(carrier.key, "pricingMode")) || "fixed");
    const pickupPoints = custom ? parsePickupPoints(settings.get(customSettingKey(carrier.key, "pickupPoints"))) : [];
    return {
      ...carrier,
      custom,
      description: custom
        ? String(settings.get(customSettingKey(carrier.key, "description")) || "Entrega personalizada.")
        : "",
      flatRate: custom && Number.isFinite(rawRate) && rawRate >= 0 ? rawRate : 0,
      pricingMode: custom && rawPricingMode === "agreement" ? "agreement" : custom && rawPricingMode === "free" ? "free" : "fixed",
      deliveryDays: await deliveryDaysForCarrier(carrier.key),
      shippingSurcharge: await shippingSurchargeForCarrier(carrier.key),
      freeShippingMinimumSubtotal: await freeShippingMinimumSubtotalForCarrier(carrier.key),
      freeShippingMinimumDeliveryTypes: await freeShippingMinimumDeliveryTypesForCarrier(carrier.key),
      pickupPoints,
    };
  }));
}

async function readShippingCarriers(options?: { visibleToMerchantOnly?: boolean }): Promise<ShippingCarrierView[]> {
  try {
    const carriers = await prisma.shippingCarrier.findMany({
      where: options?.visibleToMerchantOnly ? { visibleToMerchant: true } : undefined,
      select: {
        id: true,
        key: true,
        name: true,
        enabled: true,
        visibleToMerchant: true,
      },
    });
    return withCustomCarrierSettings(carriers);
  } catch (error) {
    if (!isMissingVisibleToMerchantError(error)) throw error;

    const legacy = await prisma.shippingCarrier.findMany({
      select: {
        id: true,
        key: true,
        name: true,
        enabled: true,
      },
    });

    const mapped = legacy.map((carrier) => ({
      ...carrier,
      visibleToMerchant: defaultVisibilityForKey(carrier.key),
    }));

    return withCustomCarrierSettings(options?.visibleToMerchantOnly ? mapped.filter((carrier) => carrier.visibleToMerchant) : mapped);
  }
}

export async function getShippingCarriers(options?: { visibleToMerchantOnly?: boolean }) {
  const existing = await readShippingCarriers();
  const byKey = new Map(existing.map((c) => [c.key, c]));
  const missing = DEFAULT_CARRIERS.filter((c) => !byKey.has(c.key));

  if (missing.length > 0) {
    for (const c of missing) {
      try {
        await createCarrierBase(c);
        await setCarrierVisibilityIfSupported(c.key, c.visibleToMerchant);
      } catch (error) {
        const prismaError = error as { code?: string; meta?: { cause?: string } };
        const code = prismaError.code || prismaError.meta?.cause;
        if (code !== "P2002") throw error;
      }
    }
  }

  await reconcileShippingCarrierDefaults(await readShippingCarriers());
  const list = await readShippingCarriers(options);
  return list.sort(orderByDefault);
}

export async function isCarrierEnabled(key: ShippingCarrierKey): Promise<boolean> {
  const list = await getShippingCarriers();
  const found = list.find((c) => c.key === key);
  return found ? found.enabled : true;
}

export async function createCustomShippingCarrier(input: {
  name: string;
  description?: string;
  flatRate?: number;
  pricingMode?: "fixed" | "agreement" | "free";
  pickupPoints?: ShippingPickupPoint[];
}) {
  const name = String(input.name || "").trim().slice(0, 80);
  if (!name) throw new Error("Nombre requerido.");

  const baseSlug = slugifyCustomCarrierName(name);
  if (!baseSlug) throw new Error("Nombre inválido.");

  const existing = await getShippingCarriers();
  const existingKeys = new Set(existing.map((carrier) => carrier.key));
  let key = `custom-${baseSlug}`;
  let suffix = 2;
  while (existingKeys.has(key)) {
    key = `custom-${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const flatRate = Math.max(0, Number(input.flatRate || 0));
  const description = String(input.description || "Entrega personalizada.").trim().slice(0, 200);

  const carrier = await createCarrierBase({ key, name, enabled: true });
  await setCarrierVisibilityIfSupported(key, true);

  await setCustomShippingCarrierSettings(key, { description, flatRate, pricingMode: input.pricingMode, pickupPoints: input.pickupPoints });
  const carriers = await getShippingCarriers();
  return carriers.find((item) => item.key === carrier.key) || carriers[0];
}

export async function setCustomShippingCarrierSettings(
  carrierKey: string,
  input: { description?: string; flatRate?: number; pricingMode?: "fixed" | "agreement" | "free"; pickupPoints?: ShippingPickupPoint[] },
) {
  if (!isCustomShippingCarrierKey(carrierKey)) throw new Error("Método personalizado inválido.");

  const flatRate = Math.max(0, Number(input.flatRate || 0));
  const description = String(input.description || "Entrega personalizada.").trim().slice(0, 200);
  const pricingMode = input.pricingMode === "agreement" ? "agreement" : input.pricingMode === "free" ? "free" : "fixed";
  const pickupPoints = normalizePickupPoints(input.pickupPoints);

  await prisma.$transaction([
    prisma.shippingProviderSetting.upsert({
      where: { provider_key: { provider: CUSTOM_SHIPPING_PROVIDER, key: customSettingKey(carrierKey, "description") } },
      create: {
        provider: CUSTOM_SHIPPING_PROVIDER,
        key: customSettingKey(carrierKey, "description"),
        value: description,
        isSecret: false,
      },
      update: { value: description, isSecret: false },
    }),
    prisma.shippingProviderSetting.upsert({
      where: { provider_key: { provider: CUSTOM_SHIPPING_PROVIDER, key: customSettingKey(carrierKey, "flatRate") } },
      create: {
        provider: CUSTOM_SHIPPING_PROVIDER,
        key: customSettingKey(carrierKey, "flatRate"),
        value: String(flatRate),
        isSecret: false,
      },
      update: { value: String(flatRate), isSecret: false },
    }),
    prisma.shippingProviderSetting.upsert({
      where: { provider_key: { provider: CUSTOM_SHIPPING_PROVIDER, key: customSettingKey(carrierKey, "pricingMode") } },
      create: {
        provider: CUSTOM_SHIPPING_PROVIDER,
        key: customSettingKey(carrierKey, "pricingMode"),
        value: pricingMode,
        isSecret: false,
      },
      update: { value: pricingMode, isSecret: false },
    }),
    prisma.shippingProviderSetting.upsert({
      where: { provider_key: { provider: CUSTOM_SHIPPING_PROVIDER, key: customSettingKey(carrierKey, "pickupPoints") } },
      create: {
        provider: CUSTOM_SHIPPING_PROVIDER,
        key: customSettingKey(carrierKey, "pickupPoints"),
        value: JSON.stringify(pickupPoints),
        isSecret: false,
      },
      update: { value: JSON.stringify(pickupPoints), isSecret: false },
    }),
  ]);
}

export function getDefaultCarrierOrder() {
  return DEFAULT_CARRIERS.map((c) => c.key);
}
