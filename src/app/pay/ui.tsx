"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OrderResp =
  | { ok: true; order: any }
  | { ok: false; error: string };

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function badge(status: string) {
  const s = (status || "").toLowerCase();
  if (s === "paid" || s === "approved") return "border-emerald-900/40 bg-emerald-900/20 text-emerald-200";
  if (s === "pending_payment" || s === "pending" || s === "in_process") return "border-amber-900/40 bg-amber-900/20 text-amber-200";
  if (s === "cancelled" || s === "rejected" || s === "failure") return "border-red-900/40 bg-red-900/20 text-red-200";
  return "border-zinc-800 bg-zinc-900/30 text-zinc-200";
}

export default function PayResultClient({
  title,
  subtitle,
  orderId,
  hint,
}: {
  title: string;
  subtitle: string;
  orderId: string;
  hint?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrderResp | null>(null);

  const ok = data && (data as any).ok;

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as OrderResp | null;
      if (!alive) return;
      setData(json ?? { ok: false, error: "Respuesta inválida." });
      setLoading(false);
    }

    load();

    // poll suave: a veces el webhook tarda, entonces refrescamos 3 veces
    const t1 = setTimeout(load, 2500);
    const t2 = setTimeout(load, 6000);
    const t3 = setTimeout(load, 12000);

    return () => {
      alive = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [orderId]);

  const order = ok ? (data as any).order : null;

  const effectiveStatus = useMemo(() => {
    if (!order) return "unknown";
    // preferimos order.status, pero mostramos payment.status también
    return order.status || order.payment?.status || "unknown";
  }, [order]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-400">
                Orden: <span className="font-mono text-zinc-200">{orderId}</span>
              </div>

              <span className={["rounded-full border px-3 py-1 text-xs", badge(effectiveStatus)].join(" ")}>
                {String(effectiveStatus).replaceAll("_", " ")}
              </span>
            </div>

            {hint && (
              <div className="mt-3 text-xs text-zinc-500">{hint}</div>
            )}

            {loading && (
              <div className="mt-4 text-sm text-zinc-300">Cargando estado…</div>
            )}

            {!loading && data && !(data as any).ok && (
              <div className="mt-4 rounded-xl border border-red-900/40 bg-red-900/20 p-3 text-sm text-red-200">
                {(data as any).error || "No se pudo cargar la orden."}
              </div>
            )}

            {!loading && ok && order && (
              <>
                <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
                  <span className="text-zinc-400">Total</span>
                  <span className="text-lg font-semibold">{money(Number(order.total))}</span>
                </div>

                <div className="mt-4 space-y-2">
                  {order.items.map((it: any, idx: number) => (
                    <div key={idx} className="flex items-start justify-between gap-4 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{it.name}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {it.quantity} × {money(Number(it.unitPrice))}
                        </div>
                      </div>
                      <div className="shrink-0 text-zinc-200">{money(Number(it.subtotal))}</div>
                    </div>
                  ))}
                </div>

                {order.payment && (
                  <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm">
                    <div className="text-zinc-400">Pago</div>
                    <div className="mt-1">
                      <span className="text-zinc-200">{order.payment.provider}</span>{" "}
                      · <span className="text-zinc-200">{order.payment.status}</span>
                    </div>
                    {order.payment.paymentId && (
                      <div className="mt-1 text-xs text-zinc-500">
                        paymentId: <span className="font-mono">{order.payment.paymentId}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              Volver a la tienda
            </Link>

            <Link
              href="/account/orders"
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60"
            >
              Ver mis pedidos
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
