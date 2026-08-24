"use client";

import Link from "next/link";
import Image from "next/image";
import { Fragment, useEffect, useMemo, useState } from "react";
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
import { ChevronDown } from "lucide-react";

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

type ShippingOption = {
  key: string;
  label: string;
  description?: string;
  amount: number;
  deliveryType: "D" | "S" | null;
  agreement?: boolean;
  freeShipping?: boolean;
};
type PickupAgency = { code: string; name: string; addressLine: string; city: string; province: string; zip: string };

const SELECTED_SHIPPING_KEY = "fika:selected-shipping";
const SHIPPING_LOGO_BASE_URL = "https://dk0k1i3js6c49.cloudfront.net/iconos-envio";

function shippingLogoUrl(method: string) {
  if (method === "epick") return "/images/epick.png";
  if (method === "correo") return "/images/correo-argentino.png";
  if (method === "andreani") return `${SHIPPING_LOGO_BASE_URL}/andreani.png`;
  if (method === "pickup") return `${SHIPPING_LOGO_BASE_URL}/acordar.png`;
  return `${SHIPPING_LOGO_BASE_URL}/personalizado.png`;
}

function provinceCodeFromPostalCode(postalCode: string) {
  const value = Number(postalCode.replace(/\D/g, ""));
  if (!Number.isFinite(value)) return "B";
  if (value >= 1000 && value < 1500) return "C";
  if (value >= 1500 && value < 2000) return "B";
  if (value >= 2000 && value < 3000) return "S";
  if (value >= 3000 && value < 4000) return "E";
  if (value >= 4000 && value < 5000) return "T";
  if (value >= 5000 && value < 6000) return "X";
  if (value >= 6000 && value < 7000) return "B";
  if (value >= 7000 && value < 8000) return "W";
  if (value >= 8000 && value < 9000) return "N";
  return "B";
}

function postalDistance(a: string, b: string) {
  const left = Number(String(a || "").replace(/\D/g, ""));
  const right = Number(String(b || "").replace(/\D/g, ""));
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.abs(left - right);
}

export default function CartPanel({ onClose }: { onClose?: () => void }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [promoInput, setPromoInput] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);
  const [shippingPostalCode, setShippingPostalCode] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<string | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [correoAgencies, setCorreoAgencies] = useState<PickupAgency[]>([]);
  const [selectedAgencyCode, setSelectedAgencyCode] = useState("");
  const [correoAgenciesLoading, setCorreoAgenciesLoading] = useState(false);

  async function calculateShipping() {
    const postalCode = shippingPostalCode.trim();
    if (!postalCode) {
      setShippingError("Ingresá un código postal.");
      setShippingOptions([]);
      return;
    }

    setShippingLoading(true);
    setShippingError(null);
    try {
      const [carriersRes, epickRes, andreaniRes, correoRes] = await Promise.all([
        fetch("/api/shipping/carriers"),
        fetch("/api/shipping/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postalCode }) }),
        fetch("/api/shipping/andreani/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cpDestino: postalCode }) }),
        fetch("/api/shipping/correo-argentino/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postalCode }) }),
      ]);
      const carriersData = await carriersRes.json().catch(() => ({}));
      const carriers = Array.isArray(carriersData?.carriers) ? carriersData.carriers : [];
      const enabled = (key: string) =>
        carriers.find((carrier: { key?: unknown; enabled?: unknown }) => String(carrier.key) === key)?.enabled !== false;
      const options: ShippingOption[] = [];
      const epick = await epickRes.json().catch(() => ({}));
      const epickAmount = Number(epick?.quote?.price ?? epick?.quote?.total ?? 0);
      const epickCarrier = carriers.find((carrier: { key?: unknown }) => String(carrier.key) === "epick");
      const correoCarrier = carriers.find((carrier: { key?: unknown }) => String(carrier.key) === "correo");
      const daysLabel = (carrier: { deliveryDays?: unknown } | undefined) => {
        const days = String(carrier?.deliveryDays || "").trim();
        return /^(\d+)(\s*-\s*\d+)?$/.test(days) ? `${days} días hábiles luego de ser despachado` : undefined;
      };
      if (enabled("epick") && epickRes.ok && epickAmount > 0) options.push({ key: "epick", label: "Envío a domicilio (E-pick)", description: daysLabel(epickCarrier), amount: epickAmount, deliveryType: "D" });
      const andreani = await andreaniRes.json().catch(() => ({}));
      const andreaniAmount = Number(andreani?.quote?.tarifaConIva?.total ?? 0);
      if (enabled("andreani") && andreaniRes.ok && andreaniAmount > 0) options.push({ key: "andreani", label: "Envío a domicilio (Andreani)", amount: andreaniAmount, deliveryType: "D" });
      const correo = await correoRes.json().catch(() => ({}));
      const correoRates = Array.isArray(correo?.quote?.rates) ? correo.quote.rates : [];
      // Correo puede devolver varias tarifas para el mismo destino; en el
      // carrito mostramos una sola opción por modalidad, igual que checkout.
      for (const deliveryType of ["D", "S"] as const) {
        const rate = correoRates.find((item: { deliveredType?: string }) => item?.deliveredType === deliveryType);
        const amount = Number(rate?.price ?? 0);
        if (enabled("correo") && correoRes.ok && amount > 0) {
          options.push({
            key: "correo",
            label: deliveryType === "S" ? "Envío a sucursal" : "Envío a domicilio (Correo Argentino)",
            description: daysLabel(correoCarrier),
            amount,
            deliveryType,
          });
        }
      }
      for (const carrier of carriers) {
        const key = String(carrier?.key || "");
        if (!key || ["epick", "andreani", "correo"].includes(key) || !carrier.enabled) continue;
        options.push({ key, label: String(carrier.name || key), description: carrier.description || undefined, amount: Number(carrier.flatRate || 0), deliveryType: null, agreement: carrier.pricingMode === "agreement" });
      }
      const optionsWithPromos = await Promise.all(
        options.map(async (option) => {
          if (option.agreement || option.amount <= 0) return option;
          const pricingRes = await fetch("/api/promotions/cart-pricing", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
              promoCode,
              deliveryType: option.deliveryType,
              carrierKey: option.key,
            }),
          });
          const pricingData = await pricingRes.json().catch(() => ({}));
          return { ...option, freeShipping: pricingRes.ok && pricingData?.pricing?.summary?.freeShipping === true };
        })
      );
      setShippingOptions(optionsWithPromos);
      const stored = localStorage.getItem(SELECTED_SHIPPING_KEY);
      const preferred = stored ? JSON.parse(stored) : null;
      setSelectedAgencyCode(String(preferred?.agencyCode || ""));
      setSelectedShipping(optionsWithPromos.some((option) => option.key === preferred?.key && option.deliveryType === (preferred?.deliveryType ?? null)) ? `${preferred.key}:${preferred.deliveryType ?? ""}` : optionsWithPromos[0] ? `${optionsWithPromos[0].key}:${optionsWithPromos[0].deliveryType ?? ""}` : null);
      if (optionsWithPromos.length === 0) setShippingError("No se pudo cotizar con los proveedores disponibles.");
      localStorage.setItem(
        SELECTED_SHIPPING_KEY,
        JSON.stringify({
          key: preferred?.key || optionsWithPromos[0]?.key,
          deliveryType: preferred?.deliveryType ?? optionsWithPromos[0]?.deliveryType ?? null,
          postalCode,
        })
      );
      if (optionsWithPromos.some((option) => option.key === "correo" && option.deliveryType === "S")) {
        void loadCorreoAgencies();
      }
    } finally {
      setShippingLoading(false);
    }
  }

  async function loadCorreoAgencies() {
    const postalCode = shippingPostalCode.trim();
    if (!postalCode) return;
    setCorreoAgenciesLoading(true);
    setCorreoAgencies([]);
    try {
    const provinceCode = provinceCodeFromPostalCode(postalCode);
    const target = Number(postalCode.replace(/\D/g, ""));
    const request = (postal?: string) => fetch("/api/shipping/correo-argentino/agencies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provinceCode, ...(postal ? { postalCode: postal } : {}) }),
    });
    const nearbyCodes = Number.isFinite(target)
      ? Array.from({ length: 5 }, (_, index) => String(target - 2 + index))
      : [postalCode];
    const payloads: Array<{ agencies?: unknown }> = [];
    for (const code of [undefined, ...nearbyCodes]) {
      const response = await request(code).catch(() => null);
      payloads.push(response ? await response.json().catch(() => ({})) : {});
    }
    const agencies = payloads.flatMap((data) => Array.isArray(data?.agencies) ? data.agencies : []);
    if (!agencies.length) return;
    const uniqueAgencies = (agencies as PickupAgency[]).filter(
      (agency, index, list) => list.findIndex((item) => item.code === agency.code) === index
    );
    const sortedAgencies = [...uniqueAgencies].sort(
      (a, b) => postalDistance(a.zip, postalCode) - postalDistance(b.zip, postalCode)
    );
    const nearbyAgencies = sortedAgencies.filter((agency) => {
      const distance = postalDistance(agency.zip, postalCode);
      return Number.isFinite(distance) && distance <= 50;
    });
    const candidates = nearbyAgencies;
      setCorreoAgencies(
        candidates.filter((agency, index, list) => list.findIndex((item) => item.code === agency.code) === index).slice(0, 4)
      );
    } finally {
      setCorreoAgenciesLoading(false);
    }
  }

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

  const rawCartTotal = items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  const subtotalBase = pricing?.summary?.subtotalBase ?? rawCartTotal;
  const codeDiscountAmount = pricing?.summary?.codeDiscountAmount ?? 0;
  const selectedShippingOption = shippingOptions.find(
    (option) => `${option.key}:${option.deliveryType ?? ""}` === selectedShipping
  );
  const shippingAmount = selectedShippingOption?.agreement || selectedShippingOption?.freeShipping
    ? 0
    : Number(selectedShippingOption?.amount ?? 0);
  const cartDisplayTotal = Math.max(0, subtotalBase - codeDiscountAmount + shippingAmount);

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
                  return <span>${base.toLocaleString("es-AR")}</span>;
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
                ${Number((pricingById.get(it.productId)?.basePrice ?? it.price) * it.quantity).toLocaleString("es-AR")}
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

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-[var(--surface)] p-4">
        <div className="mb-4 divide-y divide-zinc-800 border-y border-zinc-800">
          <section>
            <button
              type="button"
              onClick={() => setShippingOpen((open) => !open)}
              className="flex w-full items-center justify-between py-4 text-left text-sm text-zinc-100"
            >
              <span>Calculá el costo de envío</span>
              <ChevronDown className={["h-4 w-4 transition-transform", shippingOpen ? "rotate-180" : ""].join(" ")} aria-hidden="true" />
            </button>
            {shippingOpen && (
              <div className="pb-4">
                <div className="flex gap-2">
                  <input
                    value={shippingPostalCode}
                    onChange={(e) => setShippingPostalCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (!shippingLoading) void calculateShipping();
                      }
                    }}
                    placeholder="Código postal"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void calculateShipping()}
                    disabled={shippingLoading}
                    className="rounded-xl border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900/60 disabled:opacity-50"
                  >
                    {shippingLoading ? "Calculando..." : "Calcular"}
                  </button>
                </div>
                {shippingError && <div className="mt-2 text-xs text-amber-300">{shippingError}</div>}
                {shippingOptions.length > 0 && (
                  <div className="mt-3 grid gap-3">
                    {shippingOptions.map((option) => {
                      const id = `${option.key}:${option.deliveryType ?? ""}`;
                      const selected = selectedShipping === id;
                      return (
                        <Fragment key={id}>
                        <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-[var(--surface)] p-3">
                          <span className="flex gap-2">
                            <input type="radio" name="cartShipping" checked={selected} onChange={() => {
                              setSelectedShipping(id);
                              if (option.key === "correo" && option.deliveryType === "S") void loadCorreoAgencies();
                              localStorage.setItem(SELECTED_SHIPPING_KEY, JSON.stringify({ key: option.key, deliveryType: option.deliveryType, postalCode: shippingPostalCode.trim() }));
                              window.dispatchEvent(new Event("shipping:changed"));
                            }} className="mt-1" />
                            <span className="flex items-start gap-2">
                              <Image
                                src={shippingLogoUrl(option.key)}
                                alt=""
                                width={28}
                                height={28}
                                unoptimized
                                className="mt-0.5 h-7 w-7 rounded-full object-contain"
                              />
                              <span><span className="block text-sm font-medium text-zinc-100">{option.label}</span>{option.description && <span className="block text-xs text-zinc-500">{option.description}</span>}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-zinc-100">{option.agreement ? "A convenir" : option.freeShipping || option.amount <= 0 ? "Gratis" : `$${option.amount.toLocaleString("es-AR")}`}</span>
                        </label>
                        {selected && option.key === "correo" && option.deliveryType === "S" && (
                          <div className="-mt-1 rounded-xl border border-zinc-800 bg-[var(--surface)] p-3">
                            <div className="mb-2 text-xs text-zinc-400">Elegí una sucursal cercana</div>
                            <div className="rounded-xl border border-zinc-800 bg-[var(--surface)]">
                              {correoAgenciesLoading && (
                                <div className="flex items-center gap-2 p-3 text-xs text-zinc-500">
                                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent" aria-hidden="true" />
                                  Buscando sucursales cercanas...
                                </div>
                              )}
                              {!correoAgenciesLoading && correoAgencies.slice(0, 4).map((agency) => (
                                <label key={agency.code} className="flex cursor-pointer gap-2 border-b border-zinc-800 p-3 last:border-b-0">
                                  <input
                                    type="radio"
                                    name="cartCorreoAgency"
                                    checked={selectedAgencyCode === agency.code}
                            onChange={() => {
                              setSelectedAgencyCode(agency.code);
                              const stored = JSON.parse(localStorage.getItem(SELECTED_SHIPPING_KEY) || "{}");
                              localStorage.setItem(SELECTED_SHIPPING_KEY, JSON.stringify({
                                ...stored,
                                agencyCode: agency.code,
                                agencyName: agency.name,
                                agencyAddressLine: agency.addressLine,
                                agencyCity: agency.city,
                                agencyProvince: agency.province,
                                agencyProvinceCode: provinceCodeFromPostalCode(shippingPostalCode),
                                agencyZip: agency.zip,
                              }));
                                      window.dispatchEvent(new Event("shipping:changed"));
                                    }}
                                  />
                                  <span className="text-xs text-zinc-400"><span className="block text-sm text-zinc-300">{agency.name}</span>{agency.addressLine}, {agency.city} ({agency.zip})</span>
                                </label>
                              ))}
                              {!correoAgenciesLoading && correoAgencies.length === 0 && <div className="p-3 text-xs text-zinc-500">No hay sucursales disponibles.</div>}
                            </div>
                          </div>
                        )}
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <button
              type="button"
              onClick={() => setPromoOpen((open) => !open)}
              className="flex w-full items-center justify-between py-4 text-left text-sm text-zinc-300"
            >
              <span>¿Tenés un descuento?</span>
              <ChevronDown className={["h-4 w-4 transition-transform", promoOpen ? "rotate-180" : ""].join(" ")} aria-hidden="true" />
            </button>
            {promoOpen && (
              <div className="pb-4">
                <div className="flex gap-2">
                  <input
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                    placeholder="Código promocional"
                    className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const code = promoInput.trim().toUpperCase();
                      setPromoCode(code);
                      writePromoCode(code);
                    }}
                    className="rounded-xl border border-zinc-800 px-3 py-2 text-xs hover:bg-zinc-900/60"
                  >
                    Aplicar
                  </button>
                </div>
                {promoCode && (
                  <button
                    type="button"
                    onClick={() => {
                      setPromoInput("");
                      setPromoCode("");
                      clearPromoCode();
                    }}
                    className="mt-2 text-xs text-zinc-500 underline hover:text-zinc-300"
                  >
                    Quitar código
                  </button>
                )}
                {pricingError && <div className="mt-2 text-xs text-amber-300">{pricingError}</div>}
                {!pricingError && pricing?.code?.valid && (
                  <div className="mt-2 text-xs text-zinc-400">
                    Código aplicado: <span className="font-mono text-zinc-200">{pricing.code.applied}</span>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-zinc-400">Subtotal</span>
          <span className="text-zinc-300">${subtotalBase.toLocaleString("es-AR")}</span>
        </div>
        {codeDiscountAmount > 0 && (
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-zinc-500">- Código promocional</span>
            <span className="text-zinc-400">-${codeDiscountAmount.toLocaleString("es-AR")}</span>
          </div>
        )}
        {selectedShippingOption && (
          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-zinc-500">Envío</span>
            <span className="text-zinc-400">
              {selectedShippingOption.agreement
                ? "A convenir"
                : shippingAmount > 0
                  ? `$${shippingAmount.toLocaleString("es-AR")}`
                  : "Gratis"}
            </span>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-zinc-300">Total</span>
          <span className="text-xl font-semibold">${Number(cartDisplayTotal).toLocaleString("es-AR")}</span>
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
