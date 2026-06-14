"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartItem,
  clearPromoCode,
  clearCart,
  readPromoCode,
  readCart,
  removeFromCart,
  setQuantity,
  writePromoCode,
} from "@/lib/cart";

type CartPricingItem = {
  productId: string;
  basePrice: number;
  finalPrice: number;
  autoPercent: number;
  codePercent: number;
  totalPercent: number;
  finalSubtotal: number;
  autoDiscountAmount: number;
  codeDiscountAmount: number;
};

type CartPricing = {
  items: CartPricingItem[];
  summary: {
    subtotalBase: number;
    subtotalDiscounted: number;
    discountAmount: number;
    autoDiscountAmount: number;
    codeDiscountAmount: number;
  };
  code?: {
    valid?: boolean;
    applied?: string | null;
    message?: string | null;
  };
};

export default function CartPanel({ onClose }: { onClose?: () => void }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setItems(readCart());
      const code = readPromoCode();
      setPromoInput(code);
      setPromoCode(code);
    };
    sync();

    const onChange = () => sync();
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (items.length === 0) {
        setPricing(null);
        setPricingError(null);
        return;
      }
      const res = await fetch("/api/promotions/cart-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
          promoCode,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setPricingError(data?.error || "No se pudo calcular promociones.");
        setPricing(null);
        return;
      }
      setPricing(data?.pricing || null);
      setPricingError(data?.pricing?.code?.valid === false && promoCode ? data?.pricing?.code?.message : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [items, promoCode]);

  const pricingById = useMemo(() => {
    const m = new Map<string, CartPricingItem>();
    for (const it of pricing?.items ?? []) m.set(it.productId, it);
    return m;
  }, [pricing]);

  const total = pricing?.summary?.subtotalDiscounted ?? items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const subtotalBase = pricing?.summary?.subtotalBase ?? total;
  const discountAmount = pricing?.summary?.discountAmount ?? 0;
  const autoDiscountAmount = pricing?.summary?.autoDiscountAmount ?? 0;
  const codeDiscountAmount = pricing?.summary?.codeDiscountAmount ?? 0;

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <p className="text-zinc-300">Tu carrito está vacío.</p>
        <Link
          href="/"
          onClick={onClose}
          className="mt-4 inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
        >
          Ver productos
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {items.map((it) => (
          <div
            key={it.productId}
            className="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4"
          >
            <div className="h-20 w-20 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.imageUrl ?? "https://placehold.co/300x300/png?text=Fika"}
                alt={it.name}
                className="h-full w-full object-cover"
              />
            </div>

            <div className="flex-1">
              <Link
                href={`/products/${it.slug}`}
                onClick={onClose}
                className="font-medium hover:underline"
              >
                {it.name}
              </Link>
              <div className="mt-1 text-sm text-zinc-400">
                {(() => {
                  const pi = pricingById.get(it.productId);
                  const base = Number(pi?.basePrice ?? it.price);
                  const final = Number(pi?.finalPrice ?? it.price);
                  const percent = Number(pi?.totalPercent ?? 0);
                  if (percent <= 0) return <span>${base.toLocaleString("es-AR")}</span>;
                  return (
                    <div>
                      <span className="line-through text-zinc-500">${base.toLocaleString("es-AR")}</span>{" "}
                      <span className="text-zinc-200">${final.toLocaleString("es-AR")}</span>{" "}
                      <span className="text-xs text-zinc-500">({percent}% OFF)</span>
                      <div className="text-xs text-zinc-500">
                        {Number(pi?.autoPercent ?? 0) > 0 && <span>Promo tienda {pi?.autoPercent}%</span>}
                        {Number(pi?.autoPercent ?? 0) > 0 && Number(pi?.codePercent ?? 0) > 0 && <span> + </span>}
                        {Number(pi?.codePercent ?? 0) > 0 && <span>Código {pi?.codePercent}%</span>}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  className="h-9 w-9 rounded-xl border border-zinc-800 hover:bg-zinc-900/60"
                  onClick={() => {
                    const next = Math.max(1, it.quantity - 1);
                    setQuantity(it.productId, next);
                  }}
                >
                  −
                </button>

                <input
                  value={it.quantity}
                  onChange={(e) => {
                    const n = Number(e.target.value || "1");
                    setQuantity(it.productId, n);
                  }}
                  className="h-9 w-16 rounded-xl border border-zinc-800 bg-zinc-950 px-2 text-center"
                  inputMode="numeric"
                />

                <button
                  className="h-9 w-9 rounded-xl border border-zinc-800 hover:bg-zinc-900/60"
                  onClick={() => {
                    const next = Math.min(it.stock, it.quantity + 1);
                    setQuantity(it.productId, next);
                  }}
                >
                  +
                </button>

                <span className="ml-2 text-xs text-zinc-500">máx {it.stock}</span>
              </div>
            </div>

            <div className="flex flex-col items-end justify-between">
              <div className="text-sm text-zinc-300">
                ${Number(pricingById.get(it.productId)?.finalSubtotal ?? it.price * it.quantity).toLocaleString("es-AR")}
              </div>

              <button
                className="text-xs text-zinc-400 hover:text-zinc-200"
                onClick={() => removeFromCart(it.productId)}
              >
                Quitar
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="text-xs text-zinc-400">Código promocional</div>
          <div className="mt-2 flex gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              placeholder=""
              className="flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                const code = promoInput.trim().toUpperCase();
                setPromoCode(code);
                writePromoCode(code);
              }}
              className="rounded-xl border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900/60"
            >
              Aplicar
            </button>
            <button
              onClick={() => {
                setPromoInput("");
                setPromoCode("");
                clearPromoCode();
              }}
              className="rounded-xl border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900/60"
            >
              Quitar
            </button>
          </div>
          {pricingError && <div className="mt-2 text-xs text-amber-300">{pricingError}</div>}
          {!pricingError && pricing?.code?.valid && (
            <div className="mt-2 text-xs text-zinc-400">
              Código aplicado: <span className="font-mono text-zinc-200">{pricing.code.applied}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Subtotal</span>
          <span className="text-zinc-300">${subtotalBase.toLocaleString("es-AR")}</span>
        </div>
        {discountAmount > 0 && (
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-zinc-400">Descuento</span>
            <span className="text-amber-300">-${discountAmount.toLocaleString("es-AR")}</span>
          </div>
        )}
        {autoDiscountAmount > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-zinc-500">- Promo tienda</span>
            <span className="text-zinc-400">-${autoDiscountAmount.toLocaleString("es-AR")}</span>
          </div>
        )}
        {codeDiscountAmount > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-zinc-500">- Código promocional</span>
            <span className="text-zinc-400">-${codeDiscountAmount.toLocaleString("es-AR")}</span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-zinc-300">Total</span>
          <span className="text-xl font-semibold">${Number(total).toLocaleString("es-AR")}</span>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => clearCart()}
            className="rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60"
          >
            Vaciar carrito
          </button>

          <Link
            href="/checkout"
            onClick={onClose}
            className="rounded-xl bg-zinc-100 px-5 py-2 text-center text-sm font-semibold text-zinc-900 hover:bg-white"
          >
            Iniciar Compra
          </Link>
        </div>
      </div>
    </>
  );
}
