import { prisma } from "@/lib/prisma";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";
import { lineItemKey } from "@/lib/productVariants";

export type PromotionType = "global" | "product" | "code";
export type PromotionPaymentMethod = "mercadopago" | "agreement" | "cash" | "transfer";
export type PromotionFreeShippingDeliveryType = "D" | "S";

export type PricingInputItem = {
  productId: string;
  quantity: number;
  productVariantId?: string | null;
  lineKey?: string;
};

export type PricedItem = {
  lineKey: string;
  productId: string;
  productVariantId: string | null;
  variantLabel: string | null;
  basePrice: number;
  finalPrice: number;
  quantity: number;
  autoPercent: number;
  codePercent: number;
  totalPercent: number;
  baseSubtotal: number;
  finalSubtotal: number;
  autoDiscountAmount: number;
  codeDiscountAmount: number;
};

export type PricingSummary = {
  subtotalBase: number;
  subtotalDiscounted: number;
  discountAmount: number;
  autoDiscountAmount: number;
  codeDiscountAmount: number;
  freeShipping: boolean;
  freeShippingPromotionName: string | null;
};

type FreeShippingDecision = {
  applies: boolean;
  promotionName: string | null;
};

export type PricingResult = {
  items: PricedItem[];
  summary: PricingSummary;
  code: {
    input: string | null;
    applied: string | null;
    percent: number;
    valid: boolean;
    message: string | null;
  };
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function normalizePromoCode(code: string | null | undefined) {
  const s = String(code || "")
    .trim()
    .toUpperCase();
  return s || null;
}

function activeWindowWhere(now: Date) {
  return {
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    ],
  };
}

const PAYMENT_METHODS = new Set<PromotionPaymentMethod>(["mercadopago", "agreement", "cash", "transfer"]);
const FREE_SHIPPING_DELIVERY_TYPES = new Set<PromotionFreeShippingDeliveryType>(["D", "S"]);

export function parsePromotionPaymentMethods(value: string | null | undefined): PromotionPaymentMethod[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((method): method is PromotionPaymentMethod => PAYMENT_METHODS.has(method));
  } catch {
    return [];
  }
}

export function parsePromotionFreeShippingDeliveryTypes(
  value: string | null | undefined
): PromotionFreeShippingDeliveryType[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((method) => String(method || "").trim().toUpperCase())
      .filter((method): method is PromotionFreeShippingDeliveryType =>
        FREE_SHIPPING_DELIVERY_TYPES.has(method as PromotionFreeShippingDeliveryType)
      );
  } catch {
    return [];
  }
}

export function parsePromotionFreeShippingCarrierKeys(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((key) => String(key || "").trim())
          .filter((key) => key.length > 0 && key.length <= 80)
      ),
    ];
  } catch {
    return [];
  }
}

function promotionMatchesFreeShippingDeliveryType(
  value: string | null | undefined,
  deliveryType?: string | null
) {
  const types = parsePromotionFreeShippingDeliveryTypes(value);
  if (types.length === 0 || !deliveryType) return true;
  return types.includes(deliveryType.toUpperCase() as PromotionFreeShippingDeliveryType);
}

function promotionMatchesFreeShippingCarrierKey(
  value: string | null | undefined,
  carrierKey?: string | null
) {
  const keys = parsePromotionFreeShippingCarrierKeys(value);
  if (keys.length === 0 || !carrierKey) return true;
  return keys.includes(carrierKey);
}

function inferredPaymentMethodsFromName(name: string | null | undefined): PromotionPaymentMethod[] {
  const text = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const methods: PromotionPaymentMethod[] = [];

  if (text.includes("efectivo")) methods.push("cash");
  if (text.includes("transferencia")) methods.push("transfer");
  if (text.includes("mercado pago") || text.includes("mercadopago")) methods.push("mercadopago");
  if (text.includes("acordar")) methods.push("agreement");

  return methods;
}

function promotionMatchesPaymentMethod(
  value: string | null | undefined,
  paymentMethod?: string | null,
  name?: string | null
) {
  const methods = parsePromotionPaymentMethods(value);
  const effectiveMethods = methods.length > 0 ? methods : inferredPaymentMethodsFromName(name);

  if (effectiveMethods.length === 0 || !paymentMethod) return true;
  return effectiveMethods.includes(paymentMethod as PromotionPaymentMethod);
}

export async function getAutomaticDiscountsForProducts(productIds: string[], paymentMethod?: string | null) {
  const ids = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: {
      isActive: true,
      type: { in: ["global", "product"] },
      ...activeWindowWhere(now),
    },
    include: {
      products: {
        where: { productId: { in: ids } },
        select: { productId: true },
      },
    },
  });
  const matchingPromos = promos.filter((promo) =>
    promotionMatchesPaymentMethod(promo.paymentMethods, paymentMethod, promo.name)
  );

  const globalMax = matchingPromos
    .filter((p) => p.type === "global")
    .reduce((acc, p) => Math.max(acc, p.percent), 0);

  for (const id of ids) map.set(id, globalMax);

  for (const promo of matchingPromos) {
    if (promo.type !== "product") continue;
    for (const pp of promo.products) {
      map.set(pp.productId, Math.max(map.get(pp.productId) ?? 0, promo.percent));
    }
  }

  return map;
}

async function getCodeDiscountPercent(code: string | null, paymentMethod?: string | null) {
  if (!code) return { percent: 0, valid: false, applied: null, message: null as string | null };

  const now = new Date();
  const promo = await prisma.promotion.findFirst({
    where: {
      isActive: true,
      type: "code",
      code,
      ...activeWindowWhere(now),
    },
    select: { code: true, percent: true, paymentMethods: true },
  });

  if (!promo) {
    return {
      percent: 0,
      valid: false,
      applied: null,
      message: "Código inválido o vencido.",
    };
  }

  if (!promotionMatchesPaymentMethod(promo.paymentMethods, paymentMethod, promo.code)) {
    return {
      percent: 0,
      valid: false,
      applied: null,
      message: "El código no aplica para el método de pago seleccionado.",
    };
  }

  return {
    percent: promo.percent,
    valid: true,
    applied: promo.code ?? code,
    message: null,
  };
}

export async function priceCartItems(
  inputItems: PricingInputItem[],
  promoCode?: string | null,
  paymentMethod?: string | null,
  deliveryType?: string | null,
  carrierKey?: string | null
): Promise<PricingResult> {
  const normalizedItems = inputItems
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      quantity: Math.floor(Number(it.quantity)),
      productVariantId: String(it.productVariantId || "").trim() || null,
      lineKey: String(it.lineKey || "").trim() || lineItemKey(String(it.productId || "").trim(), String(it.productVariantId || "").trim() || null),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0 && it.lineKey);

  if (normalizedItems.length === 0) {
    return {
      items: [],
      summary: {
        subtotalBase: 0,
        subtotalDiscounted: 0,
        discountAmount: 0,
        autoDiscountAmount: 0,
        codeDiscountAmount: 0,
        freeShipping: false,
        freeShippingPromotionName: null,
      },
      code: { input: normalizePromoCode(promoCode), applied: null, percent: 0, valid: false, message: null },
    };
  }

  const mergedMap = new Map<string, { productId: string; productVariantId: string | null; quantity: number; lineKey: string }>();
  for (const it of normalizedItems) {
    const current = mergedMap.get(it.lineKey);
    mergedMap.set(it.lineKey, {
      productId: it.productId,
      productVariantId: it.productVariantId,
      lineKey: it.lineKey,
      quantity: (current?.quantity ?? 0) + it.quantity,
    });
  }
  const merged = [...mergedMap.values()];

  const products = await prisma.product.findMany({
    where: { id: { in: merged.map((x) => x.productId) } },
    select: { id: true, price: true, isActive: true, hasVariants: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const variantIds = [...new Set(merged.map((item) => item.productVariantId).filter(Boolean) as string[])];
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true, priceOverride: true, label: true },
      })
    : [];
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

  const autoMap = await getAutomaticDiscountsForProducts(merged.map((m) => m.productId), paymentMethod);
  const normalizedCode = normalizePromoCode(promoCode);
  const codeInfo = await getCodeDiscountPercent(normalizedCode, paymentMethod);
  const items: PricedItem[] = [];

  for (const it of merged) {
    const product = byId.get(it.productId);
    if (!product || !product.isActive) continue;
    const variant = it.productVariantId ? variantsById.get(it.productVariantId) : null;
    if (it.productVariantId && (!variant || variant.productId !== it.productId)) continue;

    const basePrice = variant?.priceOverride !== null && variant?.priceOverride !== undefined ? Number(variant.priceOverride) : Number(product.price);
    const autoPercent = autoMap.get(it.productId) ?? 0;
    const codePercent = codeInfo.percent;
    const totalPercent = Math.max(0, Math.min(90, autoPercent + codePercent));
    const finalPrice = round2(basePrice * (1 - totalPercent / 100));
    const baseSubtotal = round2(basePrice * it.quantity);
    const finalSubtotal = round2(finalPrice * it.quantity);
    const autoDiscountAmount = round2(baseSubtotal * (autoPercent / 100));
    const codeDiscountAmount = round2(baseSubtotal * (codePercent / 100));

    items.push({
      lineKey: it.lineKey,
      productId: it.productId,
      productVariantId: it.productVariantId,
      variantLabel: variant?.label ?? null,
      basePrice,
      finalPrice,
      quantity: it.quantity,
      autoPercent,
      codePercent,
      totalPercent,
      baseSubtotal,
      finalSubtotal,
      autoDiscountAmount,
      codeDiscountAmount,
    });
  }

  const subtotalBase = round2(items.reduce((acc, it) => acc + it.baseSubtotal, 0));
  const subtotalDiscounted = round2(items.reduce((acc, it) => acc + it.finalSubtotal, 0));
  const discountAmount = round2(subtotalBase - subtotalDiscounted);
  const autoDiscountAmount = round2(items.reduce((acc, it) => acc + it.autoDiscountAmount, 0));
  const codeDiscountAmount = round2(items.reduce((acc, it) => acc + it.codeDiscountAmount, 0));
  const freeShippingPromo = await getFreeShippingPromotionForCart(merged, normalizedCode, paymentMethod, deliveryType, carrierKey);
  const minimumSubtotalFreeShipping = await getCarrierMinimumSubtotalFreeShipping(subtotalDiscounted, carrierKey, deliveryType);
  const freeShipping = freeShippingPromo.applies ? freeShippingPromo : minimumSubtotalFreeShipping;

  return {
    items: items.map((it) => ({
      ...it,
      autoDiscountAmount: it.autoPercent > 0 ? it.autoDiscountAmount : 0,
      codeDiscountAmount: it.codePercent > 0 ? it.codeDiscountAmount : 0,
        })),
    summary: {
      subtotalBase,
      subtotalDiscounted,
      discountAmount,
      autoDiscountAmount,
      codeDiscountAmount,
      freeShipping: freeShipping.applies,
      freeShippingPromotionName: freeShipping.promotionName,
    },
    code: {
      input: normalizedCode,
      applied: codeInfo.applied,
      percent: codeInfo.percent,
      valid: codeInfo.valid,
      message: codeInfo.message,
    },
  };
}

export async function getFreeShippingForCart(
  inputItems: PricingInputItem[],
  promoCode?: string | null,
  paymentMethod?: string | null,
  deliveryType?: string | null,
  carrierKey?: string | null
) : Promise<FreeShippingDecision> {
  const promotionFreeShipping = await getFreeShippingPromotionForCart(
    inputItems,
    promoCode,
    paymentMethod,
    deliveryType,
    carrierKey
  );
  if (promotionFreeShipping.applies) return promotionFreeShipping;

  const subtotalDiscounted = await getDiscountedSubtotalForItems(inputItems, promoCode, paymentMethod);
  return getCarrierMinimumSubtotalFreeShipping(subtotalDiscounted, carrierKey, deliveryType);
}

async function getDiscountedSubtotalForItems(
  inputItems: PricingInputItem[],
  promoCode?: string | null,
  paymentMethod?: string | null
) {
  const normalizedItems = inputItems
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      quantity: Math.floor(Number(it.quantity)),
      productVariantId: String(it.productVariantId || "").trim() || null,
      lineKey: String(it.lineKey || "").trim() || lineItemKey(String(it.productId || "").trim(), String(it.productVariantId || "").trim() || null),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0 && it.lineKey);

  if (normalizedItems.length === 0) return 0;

  const mergedMap = new Map<string, { productId: string; productVariantId: string | null; quantity: number; lineKey: string }>();
  for (const it of normalizedItems) {
    const current = mergedMap.get(it.lineKey);
    mergedMap.set(it.lineKey, {
      productId: it.productId,
      productVariantId: it.productVariantId,
      lineKey: it.lineKey,
      quantity: (current?.quantity ?? 0) + it.quantity,
    });
  }
  const merged = [...mergedMap.values()];

  const products = await prisma.product.findMany({
    where: { id: { in: merged.map((item) => item.productId) } },
    select: { id: true, price: true, isActive: true },
  });
  const byId = new Map(products.map((product) => [product.id, product]));
  const variantIds = [...new Set(merged.map((item) => item.productVariantId).filter(Boolean) as string[])];
  const variants = variantIds.length
    ? await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { id: true, productId: true, priceOverride: true },
      })
    : [];
  const variantsById = new Map(variants.map((variant) => [variant.id, variant]));
  const autoMap = await getAutomaticDiscountsForProducts(merged.map((item) => item.productId), paymentMethod);
  const codeInfo = await getCodeDiscountPercent(normalizePromoCode(promoCode), paymentMethod);

  let subtotalDiscounted = 0;
  for (const item of merged) {
    const product = byId.get(item.productId);
    if (!product || !product.isActive) continue;
    const variant = item.productVariantId ? variantsById.get(item.productVariantId) : null;
    if (item.productVariantId && (!variant || variant.productId !== item.productId)) continue;

    const basePrice = variant?.priceOverride !== null && variant?.priceOverride !== undefined ? Number(variant.priceOverride) : Number(product.price);
    const autoPercent = autoMap.get(item.productId) ?? 0;
    const codePercent = codeInfo.percent;
    const totalPercent = Math.max(0, Math.min(90, autoPercent + codePercent));
    const finalPrice = round2(basePrice * (1 - totalPercent / 100));
    subtotalDiscounted += round2(finalPrice * item.quantity);
  }

  return round2(subtotalDiscounted);
}

async function getCarrierMinimumSubtotalFreeShipping(
  subtotalDiscounted: number,
  carrierKey?: string | null,
  deliveryType?: string | null
): Promise<FreeShippingDecision> {
  if (carrierKey !== "correo") return { applies: false, promotionName: null };

  const configuredMinimum = Number(await getProviderConfigValue("correo", "FREE_SHIPPING_MIN_SUBTOTAL", "0"));
  const minimum = Number.isFinite(configuredMinimum) && configuredMinimum > 0 ? round2(configuredMinimum) : 0;
  if (!minimum || subtotalDiscounted < minimum) return { applies: false, promotionName: null };

  const rawDeliveryTypes = await getProviderConfigValue("correo", "FREE_SHIPPING_MIN_DELIVERY_TYPES", "[]");
  let deliveryTypes: string[] = [];
  try {
    const parsed = JSON.parse(rawDeliveryTypes);
    if (Array.isArray(parsed)) {
      deliveryTypes = parsed.filter((item) => item === "D" || item === "S");
    }
  } catch {
    deliveryTypes = [];
  }

  if (deliveryTypes.length > 0 && !deliveryTypes.includes(String(deliveryType || "").trim())) {
    return { applies: false, promotionName: null };
  }

  return {
    applies: true,
    promotionName: `Envío gratis desde $${minimum.toLocaleString("es-AR")}`,
  };
}

async function getFreeShippingPromotionForCart(
  inputItems: PricingInputItem[],
  promoCode?: string | null,
  paymentMethod?: string | null,
  deliveryType?: string | null,
  carrierKey?: string | null
): Promise<FreeShippingDecision> {
  const productIds = [
    ...new Set(inputItems.map((item) => String(item.productId || "").trim()).filter(Boolean)),
  ];
  if (productIds.length === 0) return { applies: false, promotionName: null as string | null };

  const code = normalizePromoCode(promoCode);
  const now = new Date();
  const promos = await prisma.promotion.findMany({
    where: {
      isActive: true,
      freeShipping: true,
      type: { in: code ? ["global", "product", "code"] : ["global", "product"] },
      ...activeWindowWhere(now),
      OR: [{ type: { not: "code" } }, { code }],
    },
    include: {
      products: {
        where: { productId: { in: productIds } },
        select: { productId: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const match = promos.find((promo) => {
    if (!promotionMatchesPaymentMethod(promo.paymentMethods, paymentMethod, promo.name)) return false;
    if (!promotionMatchesFreeShippingDeliveryType(promo.freeShippingDeliveryTypes, deliveryType)) return false;
    if (!promotionMatchesFreeShippingCarrierKey(promo.freeShippingCarrierKeys, carrierKey)) return false;
    if (promo.type === "product") return promo.products.length > 0;
    if (promo.type === "code") return Boolean(code && promo.code === code);
    return true;
  });

  return { applies: Boolean(match), promotionName: match?.name ?? null };
}
