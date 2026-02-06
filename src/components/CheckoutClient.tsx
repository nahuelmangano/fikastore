"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartItem, clearCart, readCart } from "@/lib/cart";

type Shipping = {
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  zip: string;
};

type ShippingMethod = "epick" | "andreani" | "pickup";

export default function CheckoutClient() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderItems, setOrderItems] = useState<CartItem[]>([]);
  const [shipping, setShipping] = useState<Shipping>({
    name: "",
    phone: "",
    addressLine: "",
    city: "",
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
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("epick");

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

  const summaryItems = orderId ? orderItems : items;
  const subtotal = useMemo(
    () => summaryItems.reduce((acc, it) => acc + it.price * it.quantity, 0),
    [summaryItems]
  );
  const epickAmount = Number(shippingQuote?.price ?? shippingQuote?.total ?? 0);
  const andreaniAmount = Number(andreaniQuote?.tarifaConIva?.total ?? 0);
  const shippingAmount =
    shippingMethod === "epick"
      ? epickAmount
      : shippingMethod === "andreani"
      ? andreaniAmount
      : 0;
  const total = subtotal + shippingAmount;

  useEffect(() => {
    if (!shipping.zip.trim()) return;
    const t = setTimeout(async () => {
      setQuoteError(null);
      setQuoteLoading(true);
      setAndreaniError(null);
      setAndreaniLoading(true);

      const [epickRes, andreaniRes] = await Promise.all([
        fetch("/api/shipping/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postalCode: shipping.zip.trim() }),
        }),
        fetch("/api/shipping/andreani/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cpDestino: shipping.zip.trim() }),
        }),
      ]);

      const epickData = await epickRes.json().catch(() => ({}));
      const andreaniData = await andreaniRes.json().catch(() => ({}));

      setQuoteLoading(false);
      setAndreaniLoading(false);

      if (!epickRes.ok) {
        setQuoteError(epickData?.error || "No se pudo cotizar.");
        setShippingQuote(null);
      } else {
        setShippingQuote(epickData.quote || null);
      }

      if (!andreaniRes.ok) {
        setAndreaniError(andreaniData?.error || "No se pudo cotizar Andreani.");
        setAndreaniQuote(null);
      } else {
        setAndreaniQuote(andreaniData.quote || null);
      }
    }, 500);

    return () => clearTimeout(t);
  }, [shipping.zip]);

  const canSubmit =
    items.length > 0 &&
    shipping.name.trim() &&
    shipping.phone.trim() &&
    shipping.addressLine.trim() &&
    shipping.city.trim() &&
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
                      {it.quantity} × ${it.price.toLocaleString("es-AR")}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm text-zinc-200">
                    ${(it.price * it.quantity).toLocaleString("es-AR")}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>${subtotal.toLocaleString("es-AR")}</span>
              </div>
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
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-sm font-semibold">Método de envío</div>
              <div className="mt-3 grid gap-3">
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
