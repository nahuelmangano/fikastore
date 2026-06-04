import { prisma } from "@/lib/prisma";

export type PromotionType = "global" | "product" | "code";

export type PricingInputItem = {
  productId: string;
  quantity: number;
};

export type PricedItem = {
  productId: string;
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

export async function getAutomaticDiscountsForProducts(productIds: string[]) {
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

  const globalMax = promos
    .filter((p) => p.type === "global")
    .reduce((acc, p) => Math.max(acc, p.percent), 0);

  for (const id of ids) map.set(id, globalMax);

  for (const promo of promos) {
    if (promo.type !== "product") continue;
    for (const pp of promo.products) {
      map.set(pp.productId, Math.max(map.get(pp.productId) ?? 0, promo.percent));
    }
  }

  return map;
}

async function getCodeDiscountPercent(code: string | null) {
  if (!code) return { percent: 0, valid: false, applied: null, message: null as string | null };

  const now = new Date();
  const promo = await prisma.promotion.findFirst({
    where: {
      isActive: true,
      type: "code",
      code,
      ...activeWindowWhere(now),
    },
    select: { code: true, percent: true },
  });

  if (!promo) {
    return {
      percent: 0,
      valid: false,
      applied: null,
      message: "Código inválido o vencido.",
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
  promoCode?: string | null
): Promise<PricingResult> {
  const normalizedItems = inputItems
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

  if (normalizedItems.length === 0) {
    return {
      items: [],
      summary: {
        subtotalBase: 0,
        subtotalDiscounted: 0,
        discountAmount: 0,
        autoDiscountAmount: 0,
        codeDiscountAmount: 0,
      },
      code: { input: normalizePromoCode(promoCode), applied: null, percent: 0, valid: false, message: null },
    };
  }

  const mergedMap = new Map<string, number>();
  for (const it of normalizedItems) {
    mergedMap.set(it.productId, (mergedMap.get(it.productId) ?? 0) + it.quantity);
  }
  const merged = [...mergedMap.entries()].map(([productId, quantity]) => ({ productId, quantity }));

  const products = await prisma.product.findMany({
    where: { id: { in: merged.map((x) => x.productId) } },
    select: { id: true, price: true, isActive: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const autoMap = await getAutomaticDiscountsForProducts(merged.map((m) => m.productId));
  const normalizedCode = normalizePromoCode(promoCode);
  const codeInfo = await getCodeDiscountPercent(normalizedCode);

  const items: PricedItem[] = [];

  for (const it of merged) {
    const product = byId.get(it.productId);
    if (!product || !product.isActive) continue;

    const basePrice = Number(product.price);
    const autoPercent = autoMap.get(it.productId) ?? 0;
    const codePercent = codeInfo.percent;
    const totalPercent = Math.max(0, Math.min(90, autoPercent + codePercent));
    const finalPrice = round2(basePrice * (1 - totalPercent / 100));
    const baseSubtotal = round2(basePrice * it.quantity);
    const finalSubtotal = round2(finalPrice * it.quantity);
    const autoDiscountAmount = round2(baseSubtotal * (autoPercent / 100));
    const codeDiscountAmount = round2(baseSubtotal * (codePercent / 100));

    items.push({
      productId: it.productId,
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

  return {
    items: items.map((it) => ({
      ...it,
      autoDiscountAmount: it.autoPercent > 0 ? it.autoDiscountAmount : 0,
      codeDiscountAmount: it.codePercent > 0 ? it.codeDiscountAmount : 0,
    })),
    summary: { subtotalBase, subtotalDiscounted, discountAmount, autoDiscountAmount, codeDiscountAmount },
    code: {
      input: normalizedCode,
      applied: codeInfo.applied,
      percent: codeInfo.percent,
      valid: codeInfo.valid,
      message: codeInfo.message,
    },
  };
}
