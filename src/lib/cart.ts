import { lineItemKey } from "@/lib/productVariants";

export type CartItem = {
  productId: string;
  productVariantId?: string | null;
  lineKey: string;
  slug: string;
  name: string;
  variantLabel?: string | null;
  price: number; // en ARS
  imageUrl?: string;
  quantity: number;
  stock: number;
};

const KEY = "fikastore_cart_v1";
const PROMO_KEY = "fikastore_promo_code_v1";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const productId = String((item as { productId?: unknown }).productId || "").trim();
        if (!productId) return null;
        const productVariantId = String((item as { productVariantId?: unknown }).productVariantId || "").trim() || null;
        return {
          ...(item as CartItem),
          productId,
          productVariantId,
          lineKey: String((item as { lineKey?: unknown }).lineKey || "").trim() || lineItemKey(productId, productVariantId),
          variantLabel: String((item as { variantLabel?: unknown }).variantLabel || "").trim() || null,
        };
      })
      .filter(Boolean) as CartItem[];
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart:changed"));
}

export function cartCount(items: CartItem[]) {
  return items.reduce((acc, it) => acc + it.quantity, 0);
}

export function addToCart(item: Omit<CartItem, "quantity">, qty = 1) {
  const items = readCart();
  const itemLineKey = item.lineKey || lineItemKey(item.productId, item.productVariantId);
  const idx = items.findIndex((x) => x.lineKey === itemLineKey);

  if (idx >= 0) {
    const nextQty = Math.min(items[idx].quantity + qty, item.stock);
    items[idx] = { ...items[idx], ...item, lineKey: itemLineKey, quantity: nextQty };
  } else {
    items.push({ ...item, lineKey: itemLineKey, quantity: Math.min(qty, item.stock) });
  }

  writeCart(items);
  return items;
}

export function removeFromCart(targetLineKey: string) {
  const items = readCart().filter((x) => x.lineKey !== targetLineKey);
  writeCart(items);
  return items;
}

export function setQuantity(targetLineKey: string, quantity: number) {
  const items = readCart().map((x) =>
    x.lineKey === targetLineKey
      ? { ...x, quantity: Math.max(1, Math.min(quantity, x.stock)) }
      : x
  );
  writeCart(items);
  return items;
}

export function clearCart() {
  writeCart([]);
}

export function readPromoCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(PROMO_KEY) || "";
}

export function writePromoCode(code: string) {
  if (typeof window === "undefined") return;
  const value = String(code || "").trim().toUpperCase();
  if (!value) {
    localStorage.removeItem(PROMO_KEY);
  } else {
    localStorage.setItem(PROMO_KEY, value);
  }
  window.dispatchEvent(new Event("cart:changed"));
}

export function clearPromoCode() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROMO_KEY);
  window.dispatchEvent(new Event("cart:changed"));
}
