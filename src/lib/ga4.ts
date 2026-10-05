"use client";

const CURRENCY = "ARS";

export type GA4EcommerceItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
  item_variant?: string;
  item_category?: string;
  item_brand?: string;
};

type GA4EventPayload = {
  currency?: string;
  value?: number;
  shipping?: number;
  transaction_id?: string;
  items?: GA4EcommerceItem[];
};

type GA4Window = Window & {
  gtag?: (command: "event", eventName: string, params?: GA4EventPayload) => void;
};

function gtag() {
  if (typeof window === "undefined") return null;
  return (window as GA4Window).gtag ?? null;
}

function moneyValue(value: number) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function normalizeItem(item: GA4EcommerceItem): GA4EcommerceItem | null {
  const itemId = String(item.item_id || "").trim();
  const itemName = String(item.item_name || "").trim();
  if (!itemId || !itemName) return null;

  return {
    item_id: itemId,
    item_name: itemName,
    price: moneyValue(item.price),
    quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
    ...(item.item_variant ? { item_variant: String(item.item_variant).trim() } : {}),
    ...(item.item_category ? { item_category: String(item.item_category).trim() } : {}),
    ...(item.item_brand ? { item_brand: String(item.item_brand).trim() } : {}),
  };
}

function track(eventName: string, payload: GA4EventPayload) {
  const tracker = gtag();
  if (typeof tracker !== "function") return false;

  tracker("event", eventName, {
    ...payload,
    ...(payload.value !== undefined ? { value: moneyValue(payload.value) } : {}),
    ...(payload.shipping !== undefined ? { shipping: moneyValue(payload.shipping) } : {}),
    items: payload.items?.map(normalizeItem).filter(Boolean) as GA4EcommerceItem[] | undefined,
  });
  return true;
}

export function trackGA4ViewItem(item: GA4EcommerceItem) {
  const normalized = normalizeItem(item);
  if (!normalized) return false;

  return track("view_item", {
    currency: CURRENCY,
    value: normalized.price,
    items: [normalized],
  });
}

export function trackGA4AddToCart(item: GA4EcommerceItem) {
  const normalized = normalizeItem(item);
  if (!normalized) return false;

  return track("add_to_cart", {
    currency: CURRENCY,
    value: normalized.price * normalized.quantity,
    items: [normalized],
  });
}

export function trackGA4BeginCheckout(items: GA4EcommerceItem[], value: number) {
  const normalizedItems = items.map(normalizeItem).filter(Boolean) as GA4EcommerceItem[];
  if (normalizedItems.length === 0) return false;

  return track("begin_checkout", {
    currency: CURRENCY,
    value,
    items: normalizedItems,
  });
}

export function trackGA4Purchase(input: {
  transactionId: string;
  value: number;
  shipping?: number;
  items: GA4EcommerceItem[];
}) {
  const transactionId = String(input.transactionId || "").trim();
  const normalizedItems = input.items.map(normalizeItem).filter(Boolean) as GA4EcommerceItem[];
  if (!transactionId || normalizedItems.length === 0) return false;

  return track("purchase", {
    transaction_id: transactionId,
    currency: CURRENCY,
    value: input.value,
    shipping: input.shipping,
    items: normalizedItems,
  });
}
