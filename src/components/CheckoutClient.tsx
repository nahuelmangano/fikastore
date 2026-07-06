"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartItem, clearCart, clearPromoCode, readCart, readPromoCode } from "@/lib/cart";
import { validateArgentinaPostalCodeProvince } from "@/lib/argentinaPostalCode";

type Shipping = {
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  province: string;
  provinceCode: string;
  zip: string;
};

type ShippingMethod = "epick" | "andreani" | "correo" | "pickup";
type CorreoDeliveryType = "D" | "S";

type CorreoRate = {
  deliveredType?: string;
  price?: unknown;
};

type CorreoAgency = {
  code: string;
  name: string;
  addressLine: string;
  city: string;
  province: string;
  provinceCode: string;
  zip: string;
};

type EpickQuote = {
  price?: unknown;
  total?: unknown;
};

type AndreaniQuote = {
  tarifaConIva?: {
    total?: unknown;
  };
};

type PricingItem = {
  productId: string;
  basePrice?: number;
  finalPrice?: number;
  totalPercent?: number;
  autoPercent?: number;
  codePercent?: number;
  finalSubtotal?: number;
};

type PricingData = {
  items?: PricingItem[];
  summary?: {
    subtotalBase?: number;
    subtotalDiscounted?: number;
    discountAmount?: number;
    autoDiscountAmount?: number;
    codeDiscountAmount?: number;
  };
  code?: {
    valid?: boolean;
    message?: string;
  };
};

const PROVINCES = [
  { code: "A", name: "Salta" },
  { code: "B", name: "Provincia de Buenos Aires" },
  { code: "C", name: "CABA" },
  { code: "D", name: "San Luis" },
  { code: "E", name: "Entre Rios" },
  { code: "F", name: "La Rioja" },
  { code: "G", name: "Santiago del Estero" },
  { code: "H", name: "Chaco" },
  { code: "J", name: "San Juan" },
  { code: "K", name: "Catamarca" },
  { code: "L", name: "La Pampa" },
  { code: "M", name: "Mendoza" },
  { code: "N", name: "Misiones" },
  { code: "P", name: "Formosa" },
  { code: "Q", name: "Neuquen" },
  { code: "R", name: "Rio Negro" },
  { code: "S", name: "Santa Fe" },
  { code: "T", name: "Tucuman" },
  { code: "U", name: "Chubut" },
  { code: "V", name: "Tierra del Fuego" },
  { code: "W", name: "Corrientes" },
  { code: "X", name: "Cordoba" },
  { code: "Y", name: "Jujuy" },
  { code: "Z", name: "Santa Cruz" },
];

function provinceNameFromCode(code: string) {
  const found = PROVINCES.find((p) => p.code === code);
  return found?.name || "";
}

export default function CheckoutClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderItems, setOrderItems] = useState<CartItem[]>([]);
  const [shipping, setShipping] = useState<Shipping>({
    name: "",
    phone: "",
    addressLine: "",
    city: "",
    province: "",
    provinceCode: "",
    zip: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [shippingQuote, setShippingQuote] = useState<EpickQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [andreaniQuote, setAndreaniQuote] = useState<AndreaniQuote | null>(null);
  const [andreaniLoading, setAndreaniLoading] = useState(false);
  const [andreaniError, setAndreaniError] = useState<string | null>(null);
  const [correoQuote, setCorreoQuote] = useState<{ rates?: CorreoRate[] } | null>(null);
  const [correoLoading, setCorreoLoading] = useState(false);
  const [correoError, setCorreoError] = useState<string | null>(null);
  const [correoDeliveryType, setCorreoDeliveryType] = useState<CorreoDeliveryType>("D");
  const [correoAgencies, setCorreoAgencies] = useState<CorreoAgency[]>([]);
  const [correoAgenciesLoading, setCorreoAgenciesLoading] = useState(false);
  const [correoAgenciesError, setCorreoAgenciesError] = useState<string | null>(null);
  const [selectedCorreoAgencyCode, setSelectedCorreoAgencyCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("epick");
  const [carriers, setCarriers] = useState<Record<string, boolean> | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      setItems(readCart());
      setPromoCode(readPromoCode());
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

  const summaryItems = orderId ? orderItems : items;
  const subtotalFallback = useMemo(
    () => summaryItems.reduce((acc, it) => acc + it.price * it.quantity, 0),
    [summaryItems]
  );
  const epickAmount = Number(shippingQuote?.price ?? shippingQuote?.total ?? 0);
  const andreaniAmount = Number(andreaniQuote?.tarifaConIva?.total ?? 0);
  const correoRates = Array.isArray(correoQuote?.rates) ? (correoQuote.rates as CorreoRate[]) : [];
  const correoHomeRate = correoRates.find((r) => r?.deliveredType === "D");
  const correoBranchRate = correoRates.find((r) => r?.deliveredType === "S");
  const correoHomeAmount = Number(correoHomeRate?.price ?? 0);
  const correoBranchAmount = Number(correoBranchRate?.price ?? 0);
  const selectedCorreoAgency = correoAgencies.find((agency) => agency.code === selectedCorreoAgencyCode) || null;
  const postalCodeProvinceError = validateArgentinaPostalCodeProvince(shipping.zip, shipping.provinceCode);
  const epickEnabled = carriers ? carriers.epick !== false : true;
  const andreaniEnabled = carriers ? carriers.andreani !== false : true;
  const correoEnabled = carriers ? carriers.correo !== false : true;
  const pickupEnabled = carriers ? carriers.pickup !== false : true;
  const activeCorreoAmount = correoDeliveryType === "S" ? correoBranchAmount : correoHomeAmount;
  const correoBranchNeedsAgency =
    shippingMethod === "correo" && correoDeliveryType === "S" && !selectedCorreoAgency;
  const shippingAmount =
    shippingMethod === "epick"
      ? epickAmount
      : shippingMethod === "andreani"
        ? andreaniAmount
        : shippingMethod === "correo"
          ? activeCorreoAmount
          : 0;
  const subtotalBase = pricing?.summary?.subtotalBase ?? subtotalFallback;
  const subtotalDiscounted = pricing?.summary?.subtotalDiscounted ?? subtotalFallback;
  const discountAmount = pricing?.summary?.discountAmount ?? 0;
  const autoDiscountAmount = pricing?.summary?.autoDiscountAmount ?? 0;
  const codeDiscountAmount = pricing?.summary?.codeDiscountAmount ?? 0;
  const total = subtotalDiscounted + shippingAmount;
  const requiresAddress = shippingMethod !== "pickup" && !(shippingMethod === "correo" && correoDeliveryType === "S");
  const branchReady = shippingMethod !== "correo" || correoDeliveryType !== "S" || Boolean(selectedCorreoAgency);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (summaryItems.length === 0) {
        setPricing(null);
        setPricingError(null);
        return;
      }
      const res = await fetch("/api/promotions/cart-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: summaryItems.map((it) => ({ productId: it.productId, quantity: it.quantity })),
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
  }, [summaryItems, promoCode]);

  const pricingById = useMemo(() => {
    const map = new Map<string, PricingItem>();
    for (const it of pricing?.items ?? []) map.set(it.productId, it);
    return map;
  }, [pricing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/shipping/carriers");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok && Array.isArray(data?.carriers)) {
        const map: Record<string, boolean> = {};
        for (const c of data.carriers) {
          map[String(c.key)] = Boolean(c.enabled);
        }
        setCarriers(map);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!carriers) return;
    const order: ShippingMethod[] = ["epick", "andreani", "correo", "pickup"];
    const isEnabled = (m: ShippingMethod) => carriers[m] !== false;
    if (isEnabled(shippingMethod)) return;
    const next = order.find((m) => isEnabled(m));
    if (!next) return;
    const timer = setTimeout(() => setShippingMethod(next), 0);
    return () => clearTimeout(timer);
  }, [carriers, shippingMethod]);

  useEffect(() => {
    if (!correoEnabled || !shipping.provinceCode.trim()) {
      const timer = setTimeout(() => {
        setCorreoAgencies([]);
        setSelectedCorreoAgencyCode("");
        setCorreoAgenciesError(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setCorreoAgenciesLoading(true);
      setCorreoAgenciesError(null);

      const res = await fetch("/api/shipping/correo-argentino/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provinceCode: shipping.provinceCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;

      setCorreoAgenciesLoading(false);
      if (!res.ok) {
        setCorreoAgencies([]);
        setSelectedCorreoAgencyCode("");
        setCorreoAgenciesError(data?.error || "No se pudieron consultar sucursales.");
        return;
      }

      const agencies = Array.isArray(data?.agencies) ? (data.agencies as CorreoAgency[]) : [];
      setCorreoAgencies(agencies);
      setSelectedCorreoAgencyCode((current) =>
        agencies.some((agency) => agency.code === current) ? current : ""
      );
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [shipping.provinceCode, correoEnabled]);

  useEffect(() => {
    const customerPostalCode = shipping.zip.trim();
    const shouldFetchPostalCode =
      shippingMethod === "correo" && correoDeliveryType === "S"
        ? selectedCorreoAgency?.zip?.trim()
        : customerPostalCode;
    const shouldFetchProvinceCode =
      shippingMethod === "correo" && correoDeliveryType === "S"
        ? selectedCorreoAgency?.provinceCode?.trim()
        : shipping.provinceCode.trim();
    const canQuoteEpick = Boolean(customerPostalCode);
    const canQuoteAndreani = Boolean(customerPostalCode);

    if (!shouldFetchPostalCode) return;
    if (
      shouldFetchProvinceCode &&
      validateArgentinaPostalCodeProvince(shouldFetchPostalCode, shouldFetchProvinceCode)
    ) {
      return;
    }

    const t = setTimeout(async () => {
      setQuoteError(null);
      setQuoteLoading(epickEnabled && canQuoteEpick);
      setAndreaniError(null);
      setAndreaniLoading(andreaniEnabled && canQuoteAndreani);
      setCorreoError(null);
      setCorreoLoading(correoEnabled);

      if (!epickEnabled || !canQuoteEpick) {
        setShippingQuote(null);
        setQuoteError(null);
      }
      if (!andreaniEnabled || !canQuoteAndreani) {
        setAndreaniQuote(null);
        setAndreaniError(null);
      }
      if (!correoEnabled) {
        setCorreoQuote(null);
        setCorreoError(null);
      }

      const [epickRes, andreaniRes, correoRes] = await Promise.all([
        epickEnabled && canQuoteEpick
          ? fetch("/api/shipping/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postalCode: customerPostalCode }),
            })
          : Promise.resolve(null),
        andreaniEnabled && canQuoteAndreani
          ? fetch("/api/shipping/andreani/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cpDestino: customerPostalCode }),
            })
          : Promise.resolve(null),
        correoEnabled
          ? fetch("/api/shipping/correo-argentino/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                postalCode: shouldFetchPostalCode,
                provinceCode: shouldFetchProvinceCode,
              }),
            })
          : Promise.resolve(null),
      ]);

      const epickData = epickRes ? await epickRes.json().catch(() => ({})) : null;
      const andreaniData = andreaniRes ? await andreaniRes.json().catch(() => ({})) : null;
      const correoData = correoRes ? await correoRes.json().catch(() => ({})) : null;

      setQuoteLoading(false);
      setAndreaniLoading(false);
      setCorreoLoading(false);

      if (epickRes) {
        if (!epickRes.ok) {
          setQuoteError(epickData?.error || "No se pudo cotizar.");
          setShippingQuote(null);
        } else {
          setShippingQuote(epickData?.quote || null);
        }
      }

      if (andreaniRes) {
        if (!andreaniRes.ok) {
          setAndreaniError(andreaniData?.error || "No se pudo cotizar Andreani.");
          setAndreaniQuote(null);
        } else {
          setAndreaniQuote(andreaniData?.quote || null);
        }
      }

      if (correoRes) {
        if (!correoRes.ok) {
          setCorreoError(correoData?.error || "No se pudo cotizar Correo Argentino.");
          setCorreoQuote(null);
        } else {
          setCorreoQuote(correoData?.quote || null);
        }
      }
    }, 500);

    return () => clearTimeout(t);
  }, [
    shipping.zip,
    shipping.provinceCode,
    shippingMethod,
    correoDeliveryType,
    selectedCorreoAgency?.zip,
    selectedCorreoAgency?.provinceCode,
    epickEnabled,
    andreaniEnabled,
    correoEnabled,
  ]);

  const canSubmit =
    items.length > 0 &&
    shipping.name.trim() &&
    shipping.phone.trim() &&
    shipping.provinceCode.trim() &&
    (requiresAddress
      ? shipping.addressLine.trim() &&
        shipping.city.trim() &&
        shipping.province.trim() &&
        shipping.zip.trim() &&
        !postalCodeProvinceError
      : branchReady);

  async function createOrder() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({ productId: it.productId, quantity: it.quantity })),
          shipping,
          shippingMethod,
          shippingDeliveryType: shippingMethod === "correo" ? correoDeliveryType : undefined,
          shippingBranch:
            shippingMethod === "correo" && correoDeliveryType === "S" && selectedCorreoAgency
              ? selectedCorreoAgency
              : undefined,
          shippingAmount,
          promoCode,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLoading(false);
        setError(data?.error || "No se pudo crear el pedido.");
        return;
      }

      setOrderItems(items);
      setOrderId(data.orderId);
      clearCart();
      clearPromoCode();
      setLoading(false);
    } catch {
      setLoading(false);
      setError("Error de red creando el pedido.");
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-semibold">Resumen</h2>

        {summaryItems.length === 0 ? (
          <div className="mt-4 text-zinc-300">
            Tu carrito esta vacio.{" "}
            <Link href="/" className="text-zinc-100 hover:underline">
              Volver a productos
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {summaryItems.map((it) => (
                <div key={it.productId} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.name}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {(() => {
                        const pi = pricingById.get(it.productId);
                        const base = Number(pi?.basePrice ?? it.price);
                        const final = Number(pi?.finalPrice ?? it.price);
                        const percent = Number(pi?.totalPercent ?? 0);
                        if (percent <= 0) return <span>{it.quantity} x ${base.toLocaleString("es-AR")}</span>;
                        return (
                          <div>
                            {it.quantity} x <span className="line-through text-zinc-500">${base.toLocaleString("es-AR")}</span>{" "}
                            ${final.toLocaleString("es-AR")}{" "}
                            <span className="text-xs text-zinc-500">({percent}% OFF)</span>
                            <div className="text-xs text-zinc-500">
                              {Number(pi?.autoPercent ?? 0) > 0 && <span>Promo tienda {pi?.autoPercent}%</span>}
                              {Number(pi?.autoPercent ?? 0) > 0 && Number(pi?.codePercent ?? 0) > 0 && <span> + </span>}
                              {Number(pi?.codePercent ?? 0) > 0 && <span>Codigo {pi?.codePercent}%</span>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm text-zinc-200">
                    ${Number(pricingById.get(it.productId)?.finalSubtotal ?? it.price * it.quantity).toLocaleString("es-AR")}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>${subtotalBase.toLocaleString("es-AR")}</span>
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
                  <span className="text-zinc-500">- Codigo promocional</span>
                  <span className="text-zinc-400">-${codeDiscountAmount.toLocaleString("es-AR")}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                <span>Envio</span>
                <span>{shippingMethod === "pickup" ? "Gratis" : `$${shippingAmount.toLocaleString("es-AR")}`}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-zinc-300">Total</span>
                <span className="text-xl font-semibold">${total.toLocaleString("es-AR")}</span>
              </div>
              {promoCode && (
                <div className="mt-2 text-xs text-zinc-500">
                  Codigo: <span className="font-mono text-zinc-300">{promoCode}</span>
                  {pricingError && <span className="ml-2 text-amber-300">({pricingError})</span>}
                </div>
              )}
            </div>

            <div className="mt-5">
              <Link href="/cart" className="text-sm text-zinc-400 hover:text-zinc-200">
                ← Volver al carrito
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-semibold">Datos de envio</h2>

        {orderId ? (
          <PayBlock orderId={orderId} shippingMethod={shippingMethod} />
        ) : (
          <>
            <div className="mt-4 grid gap-3">
              <Field
                label="Nombre y apellido"
                value={shipping.name}
                onChange={(v) => setShipping((s) => ({ ...s, name: v }))}
              />
              <Field
                label="Telefono"
                value={shipping.phone}
                onChange={(v) => setShipping((s) => ({ ...s, phone: v }))}
              />

              {requiresAddress && (
                <>
                  <Field
                    label="Direccion"
                    value={shipping.addressLine}
                    onChange={(v) => setShipping((s) => ({ ...s, addressLine: v }))}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="Ciudad"
                      value={shipping.city}
                      onChange={(v) => setShipping((s) => ({ ...s, city: v }))}
                    />
                    <Field
                      label="Codigo Postal"
                      value={shipping.zip}
                      onChange={(v) => setShipping((s) => ({ ...s, zip: v }))}
                    />
                  </div>
                </>
              )}

              <div>
                <label className="text-sm text-zinc-300">Provincia</label>
                <select
                  value={shipping.provinceCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setShipping((s) => ({
                      ...s,
                      provinceCode: code,
                      province: provinceNameFromCode(code),
                    }));
                    setSelectedCorreoAgencyCode("");
                  }}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                >
                  <option value="">Seleccionar</option>
                  {PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {!requiresAddress && shippingMethod === "correo" && correoDeliveryType === "S" && (
                <>
                  <div>
                    <label className="text-sm text-zinc-300">Sucursal Correo Argentino</label>
                    <select
                      value={selectedCorreoAgencyCode}
                      onChange={(e) => setSelectedCorreoAgencyCode(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                      disabled={!shipping.provinceCode || correoAgenciesLoading}
                    >
                      <option value="">
                        {correoAgenciesLoading ? "Cargando sucursales..." : "Seleccionar sucursal"}
                      </option>
                      {correoAgencies.map((agency) => (
                        <option key={agency.code} value={agency.code}>
                          {agency.name} - {agency.city} ({agency.zip})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedCorreoAgency && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-300">
                      <div className="font-medium">{selectedCorreoAgency.name}</div>
                      <div className="mt-1 text-zinc-400">
                        {selectedCorreoAgency.addressLine}, {selectedCorreoAgency.city}, {selectedCorreoAgency.province} ({selectedCorreoAgency.zip})
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 font-mono">{selectedCorreoAgency.code}</div>
                    </div>
                  )}

                  {correoAgenciesError && (
                    <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                      {correoAgenciesError}
                    </div>
                  )}
                </>
              )}

              {requiresAddress && postalCodeProvinceError && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {postalCodeProvinceError}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-sm font-semibold">Metodo de envio</div>
              <div className="mt-3 grid gap-3">
                {epickEnabled && (
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === "epick"}
                        onChange={() => setShippingMethod("epick")}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium">Envio a domicilio (E-pick)</div>
                        <div className="text-xs text-zinc-500">
                          {quoteLoading
                            ? "Cotizando..."
                            : shippingQuote?.price || shippingQuote?.total
                              ? `Estimado $${Number(shippingQuote.price ?? shippingQuote.total).toLocaleString("es-AR")}`
                              : "Ingresa tu CP para cotizar"}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {epickAmount > 0 ? `$${epickAmount.toLocaleString("es-AR")}` : "—"}
                    </div>
                  </label>
                )}

                {andreaniEnabled && (
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === "andreani"}
                        onChange={() => setShippingMethod("andreani")}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium">Envio a domicilio (Andreani)</div>
                        <div className="text-xs text-zinc-500">
                          {andreaniLoading
                            ? "Cotizando..."
                            : andreaniQuote?.tarifaConIva?.total
                              ? `Estimado $${Number(andreaniQuote.tarifaConIva.total).toLocaleString("es-AR")}`
                              : "Ingresa tu CP para cotizar"}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      {andreaniAmount > 0 ? `$${andreaniAmount.toLocaleString("es-AR")}` : "—"}
                    </div>
                  </label>
                )}

                {correoEnabled && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <label className="flex cursor-pointer items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={shippingMethod === "correo"}
                          onChange={() => setShippingMethod("correo")}
                          className="mt-1"
                        />
                        <div>
                        <div className="text-sm font-medium">Correo Argentino</div>
                        <div className="text-xs text-zinc-500">
                          {correoLoading
                            ? "Cotizando..."
                            : correoBranchNeedsAgency
                              ? "Selecciona una sucursal para cotizar"
                            : activeCorreoAmount > 0
                                ? `Estimado $${activeCorreoAmount.toLocaleString("es-AR")}`
                                : "Completa los datos para cotizar"}
                        </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">
                        {activeCorreoAmount > 0 ? `$${activeCorreoAmount.toLocaleString("es-AR")}` : "—"}
                      </div>
                    </label>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShippingMethod("correo");
                          setCorreoDeliveryType("D");
                        }}
                        className={[
                          "rounded-xl border px-3 py-2 text-left text-sm",
                          shippingMethod === "correo" && correoDeliveryType === "D"
                            ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                            : "border-zinc-800 bg-zinc-950 text-zinc-200",
                        ].join(" ")}
                      >
                        <div className="font-medium">Domicilio</div>
                        <div className="mt-1 text-xs opacity-80">
                          {correoHomeAmount > 0 ? `$${correoHomeAmount.toLocaleString("es-AR")}` : "Sin tarifa"}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShippingMethod("correo");
                          setCorreoDeliveryType("S");
                        }}
                        className={[
                          "rounded-xl border px-3 py-2 text-left text-sm",
                          shippingMethod === "correo" && correoDeliveryType === "S"
                            ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                            : "border-zinc-800 bg-zinc-950 text-zinc-200",
                        ].join(" ")}
                        >
                        <div className="font-medium">Sucursal</div>
                        <div className="mt-1 text-xs opacity-80">
                          {correoBranchNeedsAgency
                            ? "Selecciona sucursal"
                            : correoBranchAmount > 0
                              ? `$${correoBranchAmount.toLocaleString("es-AR")}`
                              : "Sin tarifa"}
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {pickupEnabled && (
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === "pickup"}
                        onChange={() => setShippingMethod("pickup")}
                        className="mt-1"
                      />
                      <div>
                        <div className="text-sm font-medium">Retiro en comercio</div>
                        <div className="text-xs text-zinc-500">Sin costo de envio</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">Gratis</div>
                  </label>
                )}
              </div>
            </div>

            {quoteError && (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {quoteError}
              </div>
            )}
            {andreaniError && (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {andreaniError}
              </div>
            )}
            {correoError && (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {correoError}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <button
              disabled={!canSubmit || loading}
              onClick={createOrder}
              className="mt-6 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Creando pedido..." : "Crear pedido"}
            </button>

            <p className="mt-3 text-xs text-zinc-500">
              Al crear el pedido, reservamos stock. Si no se paga, luego lo liberamos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function PayBlock({
  orderId,
  shippingMethod,
}: {
  orderId: string;
  shippingMethod: ShippingMethod;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epickError, setEpickError] = useState<string | null>(null);
  const [epickCreated, setEpickCreated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (shippingMethod !== "epick" || epickCreated) return;

    (async () => {
      const res = await fetch("/api/shipping/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setEpickError(data?.error || "No se pudo crear el envio en E-pick.");
        return;
      }
      setEpickCreated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, shippingMethod, epickCreated]);

  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="font-semibold text-zinc-100">Pedido creado OK</div>
      <div className="mt-2 text-sm text-zinc-300">
        ID de orden: <span className="font-mono">{orderId}</span>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {epickError && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {epickError}
        </div>
      )}

      <button
        disabled={loading}
        onClick={async () => {
          setError(null);
          setLoading(true);

          const res = await fetch("/api/payments/mercadopago/create-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
          });

          const data = await res.json().catch(() => ({}));
          setLoading(false);

          if (!res.ok) {
            const detail =
              data?.details?.message ||
              data?.details?.error ||
              data?.details?.cause?.[0]?.description ||
              data?.details?.cause?.[0]?.code;
            setError(detail ? `${data?.error || "Error"} (${detail})` : data?.error || "No se pudo iniciar el pago.");
            console.error("MP preference error", data);
            return;
          }

          window.location.href = data.initPoint;
        }}
        className="mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {loading ? "Redirigiendo..." : "Pagar con Mercado Pago"}
      </button>

      <p className="mt-3 text-xs text-zinc-500">
        Al pagar, Mercado Pago nos notificara por webhook y actualizaremos el estado del pedido automaticamente.
      </p>

      {shippingMethod === "epick" && (
        <p className="mt-2 text-xs text-zinc-500">El envio E-pick se crea automaticamente al generar el pedido.</p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-zinc-300">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
      />
    </div>
  );
}
