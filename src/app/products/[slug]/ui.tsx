"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { addToCart } from "@/lib/cart";
import SiteHeader from "@/components/SiteHeader";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function ProductDetailClient({ product, promoPercent = 0 }: { product: any; promoPercent?: number }) {
  const images: string[] = (product.images ?? []).map((x: any) => x.url);
  const fallback = "https://placehold.co/800x800/png?text=Fika";
  const [active, setActive] = useState<string>(images[0] ?? fallback);
  const [qty, setQty] = useState<number>(1);
  const [postalCode, setPostalCode] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRows, setQuoteRows] = useState<Array<{ label: string; amount: number }>>([]);

  const price = useMemo(() => Number(product.price), [product.price]);
  const promo = useMemo(() => Number(promoPercent || 0), [promoPercent]);
  const finalPrice = useMemo(
    () => (promo > 0 ? Math.round(price * (1 - promo / 100) * 100) / 100 : price),
    [price, promo]
  );
  const stock = useMemo(() => Number(product.stock), [product.stock]);

  const canBuy = product.isActive && stock > 0;

  function clampQty(n: number) {
    if (!Number.isFinite(n)) return 1;
    const max = Math.max(1, stock || 1);
    return Math.min(Math.max(1, Math.floor(n)), max);
  }

  async function quoteShipping() {
    const zip = postalCode.trim();
    if (!zip) {
      setQuoteError("Ingresá un código postal.");
      setQuoteRows([]);
      return;
    }

    setQuoteError(null);
    setQuoteRows([]);
    setQuoteLoading(true);

    const [carriersRes, epickRes, andreaniRes, correoRes] = await Promise.all([
      fetch("/api/shipping/carriers"),
      fetch("/api/shipping/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: zip }),
      }),
      fetch("/api/shipping/andreani/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpDestino: zip }),
      }),
      fetch("/api/shipping/correo-argentino/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postalCode: zip }),
      }),
    ]);

    const carriersData = await carriersRes.json().catch(() => ({}));
    const carriers = Array.isArray(carriersData?.carriers) ? carriersData.carriers : [];
    const enabled = new Map<string, boolean>();
    for (const c of carriers) enabled.set(String(c.key), Boolean(c.enabled));

    const epickData = await epickRes.json().catch(() => ({}));
    const andreaniData = await andreaniRes.json().catch(() => ({}));
    const correoData = await correoRes.json().catch(() => ({}));

    const rows: Array<{ label: string; amount: number }> = [];
    const isEnabled = (k: string) => enabled.get(k) !== false;

    if (isEnabled("epick") && epickRes.ok) {
      const amount = Number(epickData?.quote?.price ?? epickData?.quote?.total ?? 0);
      if (Number.isFinite(amount) && amount > 0) rows.push({ label: "E-pick", amount });
    }
    if (isEnabled("andreani") && andreaniRes.ok) {
      const amount = Number(andreaniData?.quote?.tarifaConIva?.total ?? 0);
      if (Number.isFinite(amount) && amount > 0) rows.push({ label: "Andreani", amount });
    }
    if (isEnabled("correo") && correoRes.ok) {
      const rate =
        correoData?.quote?.rates?.find((r: any) => r?.deliveredType === "D") ||
        correoData?.quote?.rates?.[0];
      const amount = Number(rate?.price ?? 0);
      if (Number.isFinite(amount) && amount > 0) rows.push({ label: "Correo Argentino", amount });
    }

    rows.sort((a, b) => a.amount - b.amount);
    setQuoteRows(rows);
    setQuoteLoading(false);

    if (rows.length === 0) {
      setQuoteError("No se pudo cotizar con los proveedores disponibles.");
    }
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
              {promo > 0 ? (
                <div>
                  <div className="text-sm text-zinc-500 line-through">{money(price)}</div>
                  <div className="text-2xl font-semibold">
                    {money(finalPrice)}{" "}
                    <span className="text-sm text-zinc-400">({promo}% OFF)</span>
                  </div>
                </div>
              ) : (
                <div className="text-2xl font-semibold">{money(price)}</div>
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

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4">
                <div className="text-sm font-medium">Calculá el costo de envío</div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="Código postal"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={quoteShipping}
                    disabled={quoteLoading}
                    className="rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
                  >
                    {quoteLoading ? "Calculando..." : "Calcular"}
                  </button>
                </div>

                {quoteError && <div className="mt-3 text-xs text-amber-300">{quoteError}</div>}

                {quoteRows.length > 0 && (
                  <div className="mt-3 space-y-2 text-sm">
                    {quoteRows.map((row, idx) => (
                      <div
                        key={row.label}
                        className={[
                          "flex items-center justify-between rounded-xl border px-3 py-2",
                          idx === 0 ? "border-amber-700/40 bg-amber-50/10" : "border-zinc-800 bg-zinc-900/20",
                        ].join(" ")}
                      >
                        <span className="text-zinc-300">
                          {row.label}
                          {idx === 0 && <span className="ml-2 text-xs text-amber-300">Más conveniente</span>}
                        </span>
                        <span className="font-semibold">${row.amount.toLocaleString("es-AR")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
