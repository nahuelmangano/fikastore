"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartItem, clearCart, clearPromoCode, readCart, readPromoCode } from "@/lib/cart";

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

const PROVINCES = [
  { code: "A", name: "Salta" },
  { code: "B", name: "Provincia de Buenos Aires" },
  { code: "C", name: "CABA" },
  { code: "D", name: "San Luis" },
  { code: "E", name: "Entre Ríos" },
  { code: "F", name: "La Rioja" },
  { code: "G", name: "Santiago del Estero" },
  { code: "H", name: "Chaco" },
  { code: "J", name: "San Juan" },
  { code: "K", name: "Catamarca" },
  { code: "L", name: "La Pampa" },
  { code: "M", name: "Mendoza" },
  { code: "N", name: "Misiones" },
  { code: "P", name: "Formosa" },
  { code: "Q", name: "Neuquén" },
  { code: "R", name: "Río Negro" },
  { code: "S", name: "Santa Fe" },
  { code: "T", name: "Tucumán" },
  { code: "U", name: "Chubut" },
  { code: "V", name: "Tierra del Fuego" },
  { code: "W", name: "Corrientes" },
  { code: "X", name: "Córdoba" },
  { code: "Y", name: "Jujuy" },
  { code: "Z", name: "Santa Cruz" },
];

function provinceNameFromCode(code: string) {
  const found = PROVINCES.find((p) => p.code === code);
  return found?.name || "";
}

function provinceCodeFromName(name: string) {
  const s = String(name || "").trim().toLowerCase();
  if (!s) return "";
  const found = PROVINCES.find((p) => p.name.toLowerCase() === s);
  return found?.code || "";
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
  const [shippingQuote, setShippingQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [andreaniQuote, setAndreaniQuote] = useState<any>(null);
  const [andreaniLoading, setAndreaniLoading] = useState(false);
  const [andreaniError, setAndreaniError] = useState<string | null>(null);
  const [correoQuote, setCorreoQuote] = useState<any>(null);
  const [correoLoading, setCorreoLoading] = useState(false);
  const [correoError, setCorreoError] = useState<string | null>(null);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("epick");
  const [carriers, setCarriers] = useState<Record<string, boolean> | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [pricing, setPricing] = useState<any>(null);
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
  const correoRate =
    correoQuote?.rates?.find((r: any) => r?.deliveredType === "D") ||
    correoQuote?.rates?.[0];
  const correoAmount = Number(correoRate?.price ?? 0);
  const epickEnabled = carriers ? carriers.epick !== false : true;
  const andreaniEnabled = carriers ? carriers.andreani !== false : true;
  const correoEnabled = carriers ? carriers.correo !== false : true;
  const pickupEnabled = carriers ? carriers.pickup !== false : true;
  const shippingAmount =
    shippingMethod === "epick"
      ? epickAmount
      : shippingMethod === "andreani"
      ? andreaniAmount
      : shippingMethod === "correo"
      ? correoAmount
      : 0;
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
    const map = new Map<string, any>();
    for (const it of pricing?.items ?? []) map.set(it.productId, it);
    return map;
  }, [pricing]);

  const subtotalBase = pricing?.summary?.subtotalBase ?? subtotalFallback;
  const subtotalDiscounted = pricing?.summary?.subtotalDiscounted ?? subtotalFallback;
  const discountAmount = pricing?.summary?.discountAmount ?? 0;
  const autoDiscountAmount = pricing?.summary?.autoDiscountAmount ?? 0;
  const codeDiscountAmount = pricing?.summary?.codeDiscountAmount ?? 0;
  const total = subtotalDiscounted + shippingAmount;

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
    if (next) setShippingMethod(next);
  }, [carriers, shippingMethod]);

  useEffect(() => {
    if (!shipping.zip.trim()) return;
    const t = setTimeout(async () => {
      setQuoteError(null);
      setQuoteLoading(epickEnabled);
      setAndreaniError(null);
      setAndreaniLoading(andreaniEnabled);
      setCorreoError(null);
      setCorreoLoading(correoEnabled);

      if (!epickEnabled) {
        setShippingQuote(null);
        setQuoteError(null);
      }
      if (!andreaniEnabled) {
        setAndreaniQuote(null);
        setAndreaniError(null);
      }
      if (!correoEnabled) {
        setCorreoQuote(null);
        setCorreoError(null);
      }

      const [epickRes, andreaniRes, correoRes] = await Promise.all([
        epickEnabled
          ? fetch("/api/shipping/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postalCode: shipping.zip.trim() }),
            })
          : Promise.resolve(null),
        andreaniEnabled
          ? fetch("/api/shipping/andreani/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cpDestino: shipping.zip.trim() }),
            })
          : Promise.resolve(null),
        correoEnabled
          ? fetch("/api/shipping/correo-argentino/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postalCode: shipping.zip.trim() }),
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
  }, [shipping.zip, epickEnabled, andreaniEnabled, correoEnabled]);

  const canSubmit =
    items.length > 0 &&
    shipping.name.trim() &&
    shipping.phone.trim() &&
    shipping.addressLine.trim() &&
    shipping.city.trim() &&
    shipping.province.trim() &&
    shipping.provinceCode.trim() &&
    shipping.zip.trim();

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
      clearCart(); // limpiamos carrito local porque ya generamos la orden
      clearPromoCode();
      setLoading(false);
    } catch {
      setLoading(false);
      setError("Error de red creando el pedido.");
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      {/* Resumen */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-semibold">Resumen</h2>

        {summaryItems.length === 0 ? (
          <div className="mt-4 text-zinc-300">
            Tu carrito está vacío.{" "}
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
                        if (percent <= 0) return <span>{it.quantity} × ${base.toLocaleString("es-AR")}</span>;
                        return (
                          <div>
                            {it.quantity} × <span className="line-through text-zinc-500">${base.toLocaleString("es-AR")}</span>{" "}
                            ${final.toLocaleString("es-AR")}{" "}
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
                  <span className="text-zinc-500">- Código promocional</span>
                  <span className="text-zinc-400">-${codeDiscountAmount.toLocaleString("es-AR")}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                <span>Envío</span>
                <span>
                  {shippingMethod === "pickup"
                    ? "Gratis"
                    : `$${shippingAmount.toLocaleString("es-AR")}`}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-zinc-300">Total</span>
                <span className="text-xl font-semibold">${total.toLocaleString("es-AR")}</span>
              </div>
              {promoCode && (
                <div className="mt-2 text-xs text-zinc-500">
                  Código: <span className="font-mono text-zinc-300">{promoCode}</span>
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

      {/* Datos de envío + acción */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-semibold">Datos de envío</h2>

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
                label="Teléfono"
                value={shipping.phone}
                onChange={(v) => setShipping((s) => ({ ...s, phone: v }))}
              />
              <Field
                label="Dirección"
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
                  label="Código Postal"
                  value={shipping.zip}
                  onChange={(v) => setShipping((s) => ({ ...s, zip: v }))}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Provincia"
                  value={shipping.province}
                  onChange={(v) =>
                    setShipping((s) => ({
                      ...s,
                      province: v,
                      provinceCode: provinceCodeFromName(v) || s.provinceCode,
                    }))
                  }
                />
                <div>
                  <label className="text-sm text-zinc-300">Código Provincia</label>
                  <select
                    value={shipping.provinceCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      setShipping((s) => ({
                        ...s,
                        provinceCode: code,
                        province: provinceNameFromCode(code) || s.province,
                      }));
                    }}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <option value="">Seleccionar</option>
                    {PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-sm font-semibold">Método de envío</div>
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
                      <div className="text-sm font-medium">Envío a domicilio (E-pick)</div>
                      <div className="text-xs text-zinc-500">
                        {quoteLoading
                          ? "Cotizando..."
                          : shippingQuote?.price || shippingQuote?.total
                          ? `Estimado $${Number(
                              shippingQuote.price ?? shippingQuote.total
                            ).toLocaleString("es-AR")}`
                          : "Ingresá tu CP para cotizar"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {epickAmount > 0
                      ? `$${epickAmount.toLocaleString("es-AR")}`
                      : "—"}
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
                      <div className="text-sm font-medium">Envío a domicilio (Andreani)</div>
                      <div className="text-xs text-zinc-500">
                        {andreaniLoading
                          ? "Cotizando..."
                          : andreaniQuote?.tarifaConIva?.total
                          ? `Estimado $${Number(
                              andreaniQuote.tarifaConIva.total
                            ).toLocaleString("es-AR")}`
                          : "Ingresá tu CP para cotizar"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {andreaniAmount > 0
                      ? `$${andreaniAmount.toLocaleString("es-AR")}`
                      : "—"}
                  </div>
                  </label>
                )}

                {correoEnabled && (
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="shippingMethod"
                      checked={shippingMethod === "correo"}
                      onChange={() => setShippingMethod("correo")}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-sm font-medium">Envío a domicilio (Correo Argentino)</div>
                      <div className="text-xs text-zinc-500">
                        {correoLoading
                          ? "Cotizando..."
                          : correoAmount > 0
                          ? `Estimado $${correoAmount.toLocaleString("es-AR")}`
                          : "Ingresá tu CP para cotizar"}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm font-semibold">
                    {correoAmount > 0
                      ? `$${correoAmount.toLocaleString("es-AR")}`
                      : "—"}
                  </div>
                  </label>
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
                      <div className="text-xs text-zinc-500">Sin costo de envío</div>
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
              Al crear el pedido, reservamos stock. Si no se paga, luego lo liberamos (cuando integremos el flujo de pagos).
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
        setEpickError(data?.error || "No se pudo crear el envío en E-pick.");
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
      <div className="font-semibold text-zinc-100">Pedido creado ✅</div>
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
        Al pagar, Mercado Pago nos notificará por webhook y actualizaremos el estado del pedido automáticamente.
      </p>

      {shippingMethod === "epick" && (
        <p className="mt-2 text-xs text-zinc-500">
          El envío E-pick se crea automáticamente al generar el pedido.
        </p>
      )}

      {/* Envío E-pick se gestiona fuera del checkout */}
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
