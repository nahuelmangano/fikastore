"use client";

type MetaPixelContent = {
  id: string;
  quantity?: number;
  itemPrice?: number;
};

type MetaPixelParams = {
  content_ids?: string[];
  content_name?: string;
  content_type?: "product";
  contents?: Array<{
    id: string;
    quantity?: number;
    item_price?: number;
  }>;
  currency?: string;
  value?: number;
  num_items?: number;
};

type MetaPixelOptions = {
  eventID?: string;
};

type MetaPixelWindow = Window & {
  fbq?: (
    command: "track",
    eventName: string,
    params?: MetaPixelParams,
    options?: MetaPixelOptions,
  ) => void;
};

const CURRENCY = "ARS";

function fbq() {
  if (typeof window === "undefined") return null;
  return (window as MetaPixelWindow).fbq ?? null;
}

function moneyValue(value: number) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function normalizeContents(contents: MetaPixelContent[]) {
  return contents
    .filter((item) => item.id)
    .map((item) => ({
      id: item.id,
      quantity: item.quantity,
      item_price: item.itemPrice !== undefined ? moneyValue(item.itemPrice) : undefined,
    }));
}

export function trackMetaViewContent(product: {
  id: string;
  name: string;
  price: number;
}) {
  fbq()?.("track", "ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    contents: normalizeContents([{ id: product.id, quantity: 1, itemPrice: product.price }]),
    currency: CURRENCY,
    value: moneyValue(product.price),
  });
}

export function trackMetaAddToCart(item: {
  id: string;
  name: string;
  price: number;
  quantity: number;
}) {
  fbq()?.("track", "AddToCart", {
    content_ids: [item.id],
    content_name: item.name,
    content_type: "product",
    contents: normalizeContents([{ id: item.id, quantity: item.quantity, itemPrice: item.price }]),
    currency: CURRENCY,
    value: moneyValue(item.price * item.quantity),
  });
}

export function trackMetaInitiateCheckout(items: Array<{
  id: string;
  price: number;
  quantity: number;
}>) {
  const contents = normalizeContents(items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    itemPrice: item.price,
  })));
  const value = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  fbq()?.("track", "InitiateCheckout", {
    content_ids: contents.map((item) => item.id),
    content_type: "product",
    contents,
    currency: CURRENCY,
    num_items: items.reduce((acc, item) => acc + item.quantity, 0),
    value: moneyValue(value),
  });
}

export function trackMetaPurchase(order: {
  id: string;
  total: number;
  items: Array<{
    id?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }>;
}) {
  const contents = normalizeContents(order.items.map((item, index) => ({
    id: item.id || item.name || `${order.id}-${index}`,
    quantity: item.quantity,
    itemPrice: item.unitPrice,
  })));

  fbq()?.(
    "track",
    "Purchase",
    {
      content_ids: contents.map((item) => item.id),
      content_type: "product",
      contents,
      currency: CURRENCY,
      num_items: order.items.reduce((acc, item) => acc + item.quantity, 0),
      value: moneyValue(order.total),
    },
    { eventID: `purchase:${order.id}` },
  );
}
