"use client";

import Link from "next/link";
import { useState } from "react";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function AdminOrderDetail({ order }: { order: any }) {
  const [status, setStatus] = useState<string>(order.status);
  const [shippedAt, setShippedAt] = useState<string | null>(order.shippedAt ? String(order.shippedAt) : null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const lastPayment = order.payments?.[0];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <Link href="/admin/orders" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Volver
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Tienda
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Pedido</h1>
              <div className="mt-2 font-mono text-sm text-zinc-300">{order.id}</div>
              <div className="mt-2 text-xs text-zinc-500">
                {new Date(order.createdAt).toLocaleString("es-AR")}
              </div>
            </div>

            <div className="text-right">
              <Badge label={`Orden: ${status}`} />
              <div className="mt-2 text-sm text-zinc-300">
                Total: <span className="font-semibold">{money(Number(order.total))}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Pago: {lastPayment?.status ?? "—"} {lastPayment?.paymentId ? `(${lastPayment.paymentId})` : ""}
              </div>
              {shippedAt && (
                <div className="mt-1 text-xs text-zinc-400">
                  Enviado: {new Date(shippedAt).toLocaleString("es-AR")}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="text-sm font-semibold">Cliente</div>
              <div className="mt-2 text-sm text-zinc-300">{order.user?.name ?? "—"}</div>
              <div className="mt-1 text-sm text-zinc-400">{order.user?.email ?? "—"}</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="text-sm font-semibold">Envío</div>
              <div className="mt-2 text-sm text-zinc-300">{order.shippingName}</div>
              <div className="mt-1 text-sm text-zinc-400">{order.shippingPhone}</div>
              <div className="mt-2 text-sm text-zinc-300">
                {order.shippingAddressLine}, {order.shippingCity} ({order.shippingZip})
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
            <div className="text-sm font-semibold">Items</div>
            <div className="mt-3 space-y-3">
              {order.items.map((it: any) => (
                <div
                  key={it.id}
                  className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <div>
                    <div className="font-medium">{it.nameSnapshot}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {it.quantity} × {money(Number(it.unitPrice))}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-200">{money(Number(it.subtotal))}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
              <span className="text-zinc-300">Total</span>
              <span className="text-lg font-semibold">{money(Number(order.total))}</span>
            </div>
          </div>

          {msg && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-200">
              {msg}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              disabled={loading || status !== "paid"}
              onClick={async () => {
                setMsg(null);
                setLoading(true);

                const res = await fetch(`/api/admin/orders/${order.id}/ship`, { method: "POST" });
                const data = await res.json().catch(() => ({}));

                setLoading(false);

                if (!res.ok) {
                  setMsg(data?.error || "No se pudo marcar como enviado.");
                  return;
                }

                setStatus(data.order.status);
                setShippedAt(data.order.shippedAt);
                setMsg("✅ Pedido marcado como enviado.");
              }}
              className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50 sm:w-auto"
            >
              {loading ? "Marcando..." : "Marcar como enviado"}
            </button>

            <Link
              href="/admin/orders"
              className="w-full rounded-2xl border border-zinc-800 px-4 py-3 text-center text-sm hover:bg-zinc-900/60 sm:w-auto"
            >
              Volver a pedidos
            </Link>
          </div>

          {status !== "paid" && (
            <p className="mt-3 text-xs text-zinc-500">
              * Solo se puede marcar “enviado” si el pedido está en estado <b>paid</b>.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-200">
      {label}
    </span>
  );
}
