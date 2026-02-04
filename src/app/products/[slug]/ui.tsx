"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addToCart } from "@/lib/cart";
import SiteHeader from "@/components/SiteHeader";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function ProductDetailClient({ product }: { product: any }) {
  const images: string[] = (product.images ?? []).map((x: any) => x.url);
  const fallback = "https://placehold.co/800x800/png?text=Fika";
  const [active, setActive] = useState<string>(images[0] ?? fallback);
  const [qty, setQty] = useState<number>(1);

  const price = useMemo(() => Number(product.price), [product.price]);
  const stock = useMemo(() => Number(product.stock), [product.stock]);

  const canBuy = product.isActive && stock > 0;

  function clampQty(n: number) {
    if (!Number.isFinite(n)) return 1;
    const max = Math.max(1, stock || 1);
    return Math.min(Math.max(1, Math.floor(n)), max);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <SiteHeader />
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Volver
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          {/* Galería */}
          <div>
            <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={active} alt={product.name} className="aspect-square w-full object-cover" />
            </div>

            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-3">
                {images.slice(0, 10).map((url) => (
                  <button
                    key={url}
                    onClick={() => setActive(url)}
                    className={[
                      "overflow-hidden rounded-xl border bg-zinc-900/30",
                      active === url ? "border-zinc-200" : "border-zinc-800 hover:border-zinc-600",
                    ].join(" ")}
                    aria-label="Cambiar imagen"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={product.name} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h1 className="text-2xl font-semibold">{product.name}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="text-2xl font-semibold">{money(price)}</div>

              {stock > 0 ? (
                <span className="rounded-full border border-emerald-900/40 bg-emerald-900/20 px-3 py-1 text-xs text-emerald-200">
                  Stock: {stock}
                </span>
              ) : (
                <span className="rounded-full border border-amber-900/40 bg-amber-900/20 px-3 py-1 text-xs text-amber-200">
                  Sin stock
                </span>
              )}
            </div>

            {product.description && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">
                {product.description}
              </p>
            )}

            <div className="mt-6 grid gap-3">
              <label className="text-sm text-zinc-300">Cantidad</label>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQty((q) => clampQty(q - 1))}
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
                  disabled={!canBuy || qty <= 1}
                >
                  –
                </button>

                <input
                  type="number"
                  min={1}
                  max={Math.max(1, stock)}
                  value={qty}
                  onChange={(e) => setQty(clampQty(Number(e.target.value)))}
                  className="w-24 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-center text-sm"
                  disabled={!canBuy}
                />

                <button
                  onClick={() => setQty((q) => clampQty(q + 1))}
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
                  disabled={!canBuy || qty >= stock}
                >
                  +
                </button>
              </div>

              <button
                disabled={!canBuy}
                onClick={() => {
                  addToCart(
                    {
                      productId: product.id,
                      slug: product.slug,
                      name: product.name,
                      price,
                      stock,
                      imageUrl: images[0],
                    },
                    qty
                  );
                  window.dispatchEvent(new Event("cart:open"));
                }}
                className="mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {canBuy ? "Agregar al carrito" : "No disponible"}
              </button>

              <Link
                href="/cart"
                className="w-full rounded-2xl border border-zinc-800 px-4 py-3 text-center text-sm hover:bg-zinc-900/60"
              >
                Ir al carrito
              </Link>

              <p className="text-xs text-zinc-500">
                * En el checkout validamos stock nuevamente al crear la orden.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
