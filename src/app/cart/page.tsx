"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CartItem,
  clearCart,
  readCart,
  removeFromCart,
  setQuantity,
} from "@/lib/cart";

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();

    const onChange = () => sync();
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const total = useMemo(
    () => items.reduce((acc, it) => acc + it.price * it.quantity, 0),
    [items]
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Carrito</h1>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Seguir comprando
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
            <p className="text-zinc-300">Tu carrito está vacío.</p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-4">
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
                      className="font-medium hover:underline"
                    >
                      {it.name}
                    </Link>
                    <div className="mt-1 text-sm text-zinc-400">
                      ${it.price.toLocaleString("es-AR")}
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

                      <span className="ml-2 text-xs text-zinc-500">
                        máx {it.stock}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between">
                    <div className="text-sm text-zinc-300">
                      ${ (it.price * it.quantity).toLocaleString("es-AR") }
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

            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Total</span>
                <span className="text-xl font-semibold">
                  ${total.toLocaleString("es-AR")}
                </span>
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
                  className="rounded-xl bg-zinc-100 px-5 py-2 text-center text-sm font-semibold text-zinc-900 hover:bg-white"
                >
                  Finalizar compra
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
