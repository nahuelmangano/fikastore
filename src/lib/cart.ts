export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  price: number; // en ARS
  imageUrl?: string;
  quantity: number;
  stock: number;
};

const KEY = "fikastore_cart_v1";

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
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
  const idx = items.findIndex((x) => x.productId === item.productId);

  if (idx >= 0) {
    const nextQty = Math.min(items[idx].quantity + qty, item.stock);
    items[idx] = { ...items[idx], ...item, quantity: nextQty };
  } else {
    items.push({ ...item, quantity: Math.min(qty, item.stock) });
  }

  writeCart(items);
  return items;
}

export function removeFromCart(productId: string) {
  const items = readCart().filter((x) => x.productId !== productId);
  writeCart(items);
  return items;
}

export function setQuantity(productId: string, quantity: number) {
  const items = readCart().map((x) =>
    x.productId === productId
      ? { ...x, quantity: Math.max(1, Math.min(quantity, x.stock)) }
      : x
  );
  writeCart(items);
  return items;
}

export function clearCart() {
  writeCart([]);
}
