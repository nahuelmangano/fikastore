const META_PURCHASE_CURRENCY = "ARS";

type PurchaseItemInput = {
  id?: string | null;
  quantity: number;
  unitPrice: number;
};

type PurchaseInput = {
  id: string;
  total: number;
  items: PurchaseItemInput[];
};

export type MetaPurchaseContentsItem = {
  id: string;
  quantity?: number;
  item_price?: number;
};

export type MetaPurchasePayload = {
  content_ids?: string[];
  content_type: "product";
  contents?: MetaPurchaseContentsItem[];
  currency: "ARS";
  num_items: number;
  order_id: string;
  value: number;
};

function moneyValue(value: number) {
  return Math.max(0, Math.round(Number(value || 0) * 100) / 100);
}

function normalizeContents(items: PurchaseItemInput[]) {
  return items
    .filter((item) => item.id)
    .map((item) => ({
      id: String(item.id),
      quantity: item.quantity,
      item_price: moneyValue(item.unitPrice),
    }));
}

export function buildMetaPurchaseEventId(orderId: string) {
  return `purchase_${orderId}`;
}

export function buildMetaPurchasePayload(order: PurchaseInput): MetaPurchasePayload {
  const contents = normalizeContents(order.items);
  const payload: MetaPurchasePayload = {
    content_type: "product",
    currency: META_PURCHASE_CURRENCY,
    num_items: order.items.reduce((acc, item) => acc + item.quantity, 0),
    order_id: order.id,
    value: moneyValue(order.total),
  };

  if (contents.length > 0) {
    payload.content_ids = contents.map((item) => item.id);
    payload.contents = contents;
  }

  return payload;
}
