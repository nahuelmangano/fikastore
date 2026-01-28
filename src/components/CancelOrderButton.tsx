"use client";

import { useState } from "react";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-xl border border-red-900/40 bg-red-900/20 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {done ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-zinc-300">
          Pedido cancelado.
        </div>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            const ok = window.confirm("¿Querés cancelar este pedido? Se liberará el stock.");
            if (!ok) return;

            setError(null);
            setLoading(true);

            const res = await fetch(`/api/account/orders/${orderId}/cancel`, {
              method: "POST",
            });
            const data = await res.json().catch(() => ({}));
            setLoading(false);

            if (!res.ok) {
              setError(data?.error || "No se pudo cancelar la orden.");
              return;
            }

            setDone(true);
            window.location.reload();
          }}
          className="inline-flex rounded-xl border border-red-900/40 bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/30 disabled:opacity-50"
        >
          {loading ? "Cancelando..." : "Cancelar pedido"}
        </button>
      )}
    </div>
  );
}
