"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Handshake,
  Landmark,
  Tag,
  X,
} from "lucide-react";
import { addToCart } from "@/lib/cart";
import SiteHeader from "@/components/SiteHeader";
import { sanitizeRichText } from "@/lib/richText";
import { trackMetaAddToCart, trackMetaViewContent } from "@/lib/metaPixelEvents";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function moneyWithCents(n: number) {
  return `$${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
}

function variantLabel(name: string) {
  const { variantName } = splitProductName(name);
  return variantName || "Única variante";
}

function variantAttributes(name: string) {
  const label = variantLabel(name);
  const attrs = new Map<string, string>();

  for (const part of label.split(/\s*\/\s*/)) {
    const [rawKey, ...rawValue] = part.split(/\s*:\s*/);
    const key = rawKey?.trim();
    const value = rawValue.join(":").trim();
    if (key && value) attrs.set(key, value);
  }

  return attrs;
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

function optionRank(attribute: string, value: string) {
  if (!/talle/i.test(attribute)) return Number.MAX_SAFE_INTEGER;
  const index = SIZE_ORDER.indexOf(value.toUpperCase());
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

type ProductVariant = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: unknown;
  stock: number;
  isActive: boolean;
  images?: Array<{ url: string }>;
};

type ShippingRate = {
  deliveredType?: string;
  price?: unknown;
};

type ShippingQuoteRow = {
  label: string;
  amount: number;
  carrierKey: string;
  deliveryType: "D" | "S" | null;
  freeShipping: boolean;
};

type PaymentMethodKey = "mercadopago" | "agreement" | "cash" | "transfer";

type PaymentSettings = {
  mercadopagoEnabled: boolean;
  financingDisplay: {
    goCuotas: boolean;
    mercadopago: boolean;
    manualMethods: Record<"agreement" | "cash" | "transfer", boolean>;
  };
  manualMethods: Array<{
    key: "agreement" | "cash" | "transfer";
    label: string;
    enabled: boolean;
    instructions: string;
  }>;
};

export default function ProductDetailClient({
  product,
  variants = [product],
  promoPercent = 0,
  promoPercents = {},
  promoPercentsByPaymentMethod = {},
  paymentSettings = {
    mercadopagoEnabled: false,
    financingDisplay: {
      goCuotas: true,
      mercadopago: true,
      manualMethods: { agreement: true, cash: true, transfer: true },
    },
    manualMethods: [],
  },
}: {
  product: ProductVariant;
  variants?: ProductVariant[];
  promoPercent?: number;
  promoPercents?: Record<string, number>;
  promoPercentsByPaymentMethod?: Partial<Record<PaymentMethodKey, Record<string, number>>>;
  paymentSettings?: PaymentSettings;
}) {
  const [selectedId, setSelectedId] = useState<string>(product.id);
  const selected = variants.find((variant) => variant.id === selectedId) ?? product;
  const { baseName } = splitProductName(product.name);
  const fallback = "https://placehold.co/800x800/png?text=Fika";
  const images = useMemo<string[]>(() => (selected.images ?? product.images ?? []).map((x) => x.url), [product.images, selected.images]);
  const galleryImages = useMemo(() => (images.length > 0 ? images : [fallback]), [images]);
  const [active, setActive] = useState<string>(images[0] ?? fallback);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [qty, setQty] = useState<number>(1);
  const [postalCode, setPostalCode] = useState("");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteRows, setQuoteRows] = useState<ShippingQuoteRow[]>([]);
  const [stockAlertLoading, setStockAlertLoading] = useState(false);
  const [stockAlertMessage, setStockAlertMessage] = useState<string | null>(null);
  const [financingOpen, setFinancingOpen] = useState(false);
  const lastTrackedViewContentId = useRef<string | null>(null);

  const price = Number(selected.price);
  const cashTransferPromo = Math.max(
    Number(promoPercentsByPaymentMethod.cash?.[selected.id] ?? 0),
    Number(promoPercentsByPaymentMethod.transfer?.[selected.id] ?? 0)
  );
  const promo = cashTransferPromo || Number(promoPercents[selected.id] ?? promoPercent ?? 0);
  const finalPrice = promo > 0 ? Math.round(price * (1 - promo / 100) * 100) / 100 : price;
  const installmentAmount = Math.round((finalPrice / 3) * 100) / 100;
  const stock = Number(selected.stock);
  const activeIndex = Math.max(0, galleryImages.indexOf(active));
  const activeImage = galleryImages[activeIndex] ?? galleryImages[0] ?? fallback;

  const canBuy = selected.isActive && stock > 0;
  const canRequestStockAlert = selected.isActive && stock <= 0;
  const variantAttributeEntries = variants.map((variant) => ({
    variant,
    attrs: variantAttributes(variant.name),
  }));
  const attributeNames = Array.from(
    new Set(variantAttributeEntries.flatMap((entry) => Array.from(entry.attrs.keys())))
  );
  const canUseGroupedVariants =
    variants.length > 1 &&
    attributeNames.length > 0 &&
    variantAttributeEntries.every((entry) => attributeNames.every((name) => entry.attrs.has(name)));
  const selectedAttrs = variantAttributes(selected.name);

  useEffect(() => {
    if (lastTrackedViewContentId.current === selected.id) return;
    lastTrackedViewContentId.current = selected.id;
    trackMetaViewContent({
      id: selected.id,
      name: selected.name,
      price: finalPrice,
    });
  }, [finalPrice, selected.id, selected.name]);

  function selectVariant(variant: ProductVariant) {
    setSelectedId(variant.id);
    setActive((variant.images ?? [])[0]?.url ?? fallback);
    setLightboxOpen(false);
    setQty(1);
    setStockAlertMessage(null);
    setFinancingOpen(false);
  }

  function finalPriceForPaymentMethod(method: PaymentMethodKey) {
    const methodPromo = Number(promoPercentsByPaymentMethod[method]?.[selected.id] ?? 0);
    return methodPromo > 0 ? Math.round(price * (1 - methodPromo / 100) * 100) / 100 : price;
  }

  function promoForPaymentMethod(method: PaymentMethodKey) {
    return Number(promoPercentsByPaymentMethod[method]?.[selected.id] ?? 0);
  }

  const showImageAt = useCallback((index: number) => {
    const total = galleryImages.length;
    if (total === 0) return;
    const nextIndex = (index + total) % total;
    setActive(galleryImages[nextIndex]);
  }, [galleryImages]);

  useEffect(() => {
    if (!lightboxOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLightboxOpen(false);
      if (event.key === "ArrowLeft") showImageAt(activeIndex - 1);
      if (event.key === "ArrowRight") showImageAt(activeIndex + 1);
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [activeIndex, lightboxOpen, showImageAt]);

  function selectVariantAttribute(attribute: string, value: string) {
    const nextAttrs = new Map(selectedAttrs);
    nextAttrs.set(attribute, value);

    const exact = variantAttributeEntries.find((entry) =>
      attributeNames.every((name) => entry.attrs.get(name) === nextAttrs.get(name))
    );
    const fallbackVariant = variantAttributeEntries.find((entry) => entry.attrs.get(attribute) === value);
    const nextVariant = exact?.variant ?? fallbackVariant?.variant;
    if (nextVariant) selectVariant(nextVariant);
  }

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

    const rows: ShippingQuoteRow[] = [];
    const isEnabled = (k: string) => enabled.get(k) !== false;

    if (isEnabled("epick") && epickRes.ok) {
      const amount = Number(epickData?.quote?.price ?? epickData?.quote?.total ?? 0);
      if (Number.isFinite(amount) && amount > 0) {
        rows.push({ label: "E-pick", amount, carrierKey: "epick", deliveryType: "D", freeShipping: false });
      }
    }
    if (isEnabled("andreani") && andreaniRes.ok) {
      const amount = Number(andreaniData?.quote?.tarifaConIva?.total ?? 0);
      if (Number.isFinite(amount) && amount > 0) {
        rows.push({ label: "Andreani", amount, carrierKey: "andreani", deliveryType: "D", freeShipping: false });
      }
    }
    if (isEnabled("correo") && correoRes.ok) {
      const rates = Array.isArray(correoData?.quote?.rates)
        ? (correoData.quote.rates as ShippingRate[])
        : [];
      const domicilio = rates.find((r) => r?.deliveredType === "D");
      const sucursal = rates.find((r) => r?.deliveredType === "S");
      const domicilioAmount = Number(domicilio?.price ?? 0);
      const sucursalAmount = Number(sucursal?.price ?? 0);
      if (Number.isFinite(domicilioAmount) && domicilioAmount > 0) {
        rows.push({
          label: "Correo Argentino (domicilio)",
          amount: domicilioAmount,
          carrierKey: "correo",
          deliveryType: "D",
          freeShipping: false,
        });
      }
      if (Number.isFinite(sucursalAmount) && sucursalAmount > 0) {
        rows.push({
          label: "Correo Argentino (sucursal)",
          amount: sucursalAmount,
          carrierKey: "correo",
          deliveryType: "S",
          freeShipping: false,
        });
      }
    }

    const rowsWithPromos = await Promise.all(
      rows.map(async (row) => {
        const res = await fetch("/api/promotions/cart-pricing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: [{ productId: selected.id, quantity: qty }],
            promoCode: null,
            paymentMethod: null,
            deliveryType: row.deliveryType,
            carrierKey: row.carrierKey,
          }),
        });
        const data = await res.json().catch(() => ({}));
        return {
          ...row,
          freeShipping: res.ok && data?.pricing?.summary?.freeShipping === true,
        };
      })
    );

    rowsWithPromos.sort((a, b) => {
      if (a.freeShipping !== b.freeShipping) return a.freeShipping ? -1 : 1;
      return a.amount - b.amount;
    });
    setQuoteRows(rowsWithPromos);
    setQuoteLoading(false);

    if (rowsWithPromos.length === 0) {
      setQuoteError("No se pudo cotizar con los proveedores disponibles.");
    }
  }

  async function requestStockAlert() {
    setStockAlertLoading(true);
    setStockAlertMessage(null);

    try {
      const res = await fetch(`/api/products/${selected.id}/stock-notifications`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.ok) {
        setStockAlertMessage(data?.error || "No pudimos guardar el aviso. Probá nuevamente.");
        return;
      }

      setStockAlertMessage(data?.message || "Listo. Te vamos a avisar por email cuando vuelva el stock.");
    } finally {
      setStockAlertLoading(false);
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
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block w-full cursor-zoom-in"
                aria-label="Ampliar imagen"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeImage} alt={baseName} className="aspect-square w-full object-cover" />
              </button>
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
                    <img src={url} alt={baseName} className="aspect-square w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <h1 className="text-2xl font-semibold">{baseName}</h1>

            <div className="mt-4">
              {promo > 0 ? (
                <div>
                  <div className="text-3xl font-bold tracking-normal text-zinc-100 sm:text-[2.15rem]">
                    {money(price)}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-orange-300 sm:text-[15px]">
                    <Tag className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{promo}% OFF con transferencia o efectivo</span>
                  </div>
                </div>
              ) : (
                <div className="text-3xl font-bold tracking-normal text-zinc-100 sm:text-[2.15rem]">{money(price)}</div>
              )}
            </div>

            {(promo > 0 || finalPrice > 0) && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-orange-200 bg-white text-[#351204] shadow-sm">
                {promo > 0 && (
                  <div className="flex items-center gap-3 border-b border-orange-100 px-4 py-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#9A4F16]">
                      <Tag className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-[#351204]">
                        Pagando con transferencia o efectivo
                      </div>
                      <div className="mt-1 text-base text-[#351204]">
                        Precio final: <span className="font-bold">{money(finalPrice)}</span>
                      </div>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-100 px-2.5 py-1.5 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {promo}% OFF
                    </div>
                  </div>
                )}

                {finalPrice > 0 && (
                  <button
                    type="button"
                    onClick={() => setFinancingOpen(true)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-orange-50/70"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[#70471F]">
                      <CreditCard className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1 text-base leading-6 text-[#351204]">
                      <div>3 cuotas sin interés</div>
                      <div>
                        de <span className="font-bold">{money(installmentAmount)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-[#351204]" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {variants.length > 1 && (
              <div className="mt-6">
                <div className="text-sm font-medium text-zinc-300">Variantes</div>
                {canUseGroupedVariants ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {attributeNames.map((attribute) => {
                      const values = Array.from(
                        new Set(variantAttributeEntries.map((entry) => entry.attrs.get(attribute)).filter(Boolean))
                      ) as string[];
                      values.sort((a, b) => {
                        const rankDiff = optionRank(attribute, a) - optionRank(attribute, b);
                        return rankDiff || a.localeCompare(b);
                      });

                      return (
                        <label key={attribute} className="text-sm text-zinc-300">
                          {attribute}
                          <select
                            value={selectedAttrs.get(attribute) ?? ""}
                            onChange={(event) => selectVariantAttribute(attribute, event.target.value)}
                            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
                          >
                            {values.map((value) => (
                              <option key={value} value={value}>
                                {value}
                              </option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {variants.map((variant) => {
                      const selectedVariant = variant.id === selected.id;
                      return (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => selectVariant(variant)}
                          className={[
                            "rounded-xl border px-3 py-2 text-left text-sm transition",
                            selectedVariant
                              ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                              : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900/60",
                          ].join(" ")}
                        >
                          <span className="block font-medium">{variantLabel(variant.name)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
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

              {canBuy ? (
                <button
                  onClick={() => {
                    addToCart(
                      {
                        productId: selected.id,
                        slug: selected.slug,
                        name: selected.name,
                        price,
                        stock,
                        imageUrl: images[0],
                      },
                      qty
                    );
                    trackMetaAddToCart({
                      id: selected.id,
                      name: selected.name,
                      price: finalPrice,
                      quantity: qty,
                    });
                    window.dispatchEvent(new Event("cart:open"));
                  }}
                  className="mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white"
                >
                  Agregar al carrito
                </button>
              ) : (
                <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="text-sm font-medium text-zinc-200">Producto sin stock</div>
                  {canRequestStockAlert && (
                    <button
                      type="button"
                      onClick={requestStockAlert}
                      disabled={stockAlertLoading}
                      className="mt-3 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                    >
                      {stockAlertLoading ? "Guardando..." : "Avisarme cuando vuelva a estar en stock"}
                    </button>
                  )}
                  {stockAlertMessage && (
                    <p className="mt-3 text-sm text-zinc-300" role="status">
                      {stockAlertMessage}
                    </p>
                  )}
                </div>
              )}

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
                        <span className="font-semibold">
                          {row.freeShipping ? (
                            <span className="inline-flex items-center gap-2">
                              <span className="text-xs font-medium text-zinc-500 line-through">
                                ${row.amount.toLocaleString("es-AR")}
                              </span>
                              <span className="text-emerald-300">Gratis</span>
                            </span>
                          ) : (
                            `$${row.amount.toLocaleString("es-AR")}`
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {selected.description && (
              <div
                className="mt-6 text-sm leading-6 text-zinc-300 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl"
                dangerouslySetInnerHTML={{ __html: sanitizeRichText(selected.description) }}
              />
            )}
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 text-white">
          <button
            type="button"
            className="absolute inset-0 cursor-zoom-out"
            aria-label="Cerrar imagen ampliada"
            onClick={() => setLightboxOpen(false)}
          />

          <div className="pointer-events-none absolute left-4 top-4 z-10 text-sm font-medium">
            {activeIndex + 1} / {galleryImages.length}
          </div>

          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 z-10 rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label="Cerrar"
          >
            <X className="h-7 w-7" aria-hidden="true" />
          </button>

          {galleryImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => showImageAt(activeIndex - 1)}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 text-white transition hover:bg-white/10"
                aria-label="Imagen anterior"
              >
                <ChevronLeft className="h-8 w-8" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => showImageAt(activeIndex + 1)}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 text-white transition hover:bg-white/10"
                aria-label="Imagen siguiente"
              >
                <ChevronRight className="h-8 w-8" aria-hidden="true" />
              </button>
            </>
          )}

          <div className="relative z-0 flex h-full w-full items-center justify-center p-4 sm:p-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage}
              alt={baseName}
              className="max-h-[88vh] max-w-[92vw] object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      )}

      {financingOpen && (
        <PaymentFinancingModal
          price={price}
          paymentSettings={paymentSettings}
          finalPriceForPaymentMethod={finalPriceForPaymentMethod}
          promoForPaymentMethod={promoForPaymentMethod}
          onClose={() => setFinancingOpen(false)}
        />
      )}
    </main>
  );
}

function PaymentFinancingModal({
  price,
  paymentSettings,
  finalPriceForPaymentMethod,
  promoForPaymentMethod,
  onClose,
}: {
  price: number;
  paymentSettings: PaymentSettings;
  finalPriceForPaymentMethod: (method: PaymentMethodKey) => number;
  promoForPaymentMethod: (method: PaymentMethodKey) => number;
  onClose: () => void;
}) {
  const enabledManualMethods = paymentSettings.manualMethods.filter((method) =>
    method.enabled && paymentSettings.financingDisplay.manualMethods[method.key]
  );
  const hasVisibleFinancingOptions =
    paymentSettings.financingDisplay.goCuotas ||
    (paymentSettings.mercadopagoEnabled && paymentSettings.financingDisplay.mercadopago) ||
    enabledManualMethods.length > 0;

  const manualMeta: Record<"cash" | "transfer" | "agreement", { icon: typeof Banknote; label: string }> = {
    cash: { icon: Banknote, label: "Efectivo" },
    transfer: { icon: Landmark, label: "Transferencia" },
    agreement: { icon: Handshake, label: "Acordar" },
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 px-4 py-4 text-[#351204] sm:py-8">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Cerrar métodos de pago"
        onClick={onClose}
      />

      <section className="relative mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto bg-white shadow-2xl sm:max-h-[calc(100vh-4rem)]">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4 sm:px-6">
          <h2 className="text-lg font-normal text-zinc-800">Métodos de pago y financiación</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-zinc-700 transition hover:bg-zinc-100"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-3 bg-white px-4 py-4 sm:px-7">
          {paymentSettings.financingDisplay.goCuotas ? (
            <FinancingCard
              leading={
                <div className="flex items-center gap-2 text-sm font-bold text-pink-500">
                  <span className="rounded border-2 border-pink-500 px-1 text-xs leading-5">GO</span>
                  <span>Cuotas con DÉBITO</span>
                </div>
              }
              badge="Hasta 3 cuotas sin interés"
              collapsible
            />
          ) : null}

          {paymentSettings.mercadopagoEnabled && paymentSettings.financingDisplay.mercadopago ? (
            <FinancingCard
              leading={
                <div className="flex items-center gap-2 text-sm font-bold text-sky-700">
                  <span className="flex h-7 w-9 items-center justify-center rounded-full bg-sky-100 text-xs">mp</span>
                  <span>mercado pago</span>
                </div>
              }
              badge="Hasta 3 cuotas sin interés"
              collapsible
            />
          ) : null}

          {enabledManualMethods.map((method) => {
            const meta = manualMeta[method.key];
            const Icon = meta.icon;
            const methodPromo = promoForPaymentMethod(method.key);
            const total = finalPriceForPaymentMethod(method.key);

            return (
              <FinancingCard
                key={method.key}
                leading={
                  <div className="flex items-center gap-3">
                    <Icon className="h-6 w-6 text-green-600" aria-hidden="true" />
                    <span className="text-sm font-semibold text-zinc-700">{meta.label}</span>
                  </div>
                }
                badge={methodPromo > 0 ? `${methodPromo}% OFF` : undefined}
                detail={
                  <>
                    Total en 1 pago: <span className="font-bold">{moneyWithCents(total)}</span>
                  </>
                }
              />
            );
          })}

          {!hasVisibleFinancingOptions ? (
            <FinancingCard
              leading={
                <div className="flex items-center gap-3">
                  <CreditCard className="h-6 w-6 text-green-600" aria-hidden="true" />
                  <span className="text-sm font-semibold text-zinc-700">Precio de lista</span>
                </div>
              }
              detail={
                <>
                  Total en 1 pago: <span className="font-bold">{moneyWithCents(price)}</span>
                </>
              }
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}

function FinancingCard({
  leading,
  badge,
  detail,
  collapsible = false,
}: {
  leading: ReactNode;
  detail?: ReactNode;
  badge?: string;
  collapsible?: boolean;
}) {
  return (
    <div className="rounded-md bg-white px-5 py-4 shadow-[0_2px_12px_rgba(0,0,0,0.1)]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">{leading}</div>
        {badge ? (
          <span className="shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-[11px] font-medium text-white">
            {badge}
          </span>
        ) : null}
        {collapsible ? <ChevronDown className="h-4 w-4 shrink-0 text-black" aria-hidden="true" /> : null}
      </div>
      {detail ? <div className="mt-5 text-xs text-black sm:text-sm">{detail}</div> : null}
    </div>
  );
}
