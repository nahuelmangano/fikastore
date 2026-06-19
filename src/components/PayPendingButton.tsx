"use client";

import { useState } from "react";

export default function PayPendingButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-xl border border-red-900/40 bg-red-900/20 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="button"
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
            return;
          }

          window.location.href = data.initPoint;
        }}
        className="inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {loading ? "Redirigiendo..." : "Pagar ahora"}
      </button>
    </div>
  );
}
