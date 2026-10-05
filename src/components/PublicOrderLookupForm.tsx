"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

export default function PublicOrderLookupForm() {
  const router = useRouter();
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/public/orders/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber, email }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error || "No pudimos encontrar el pedido.");
      return;
    }

    router.push(`/pedido?orderId=${encodeURIComponent(data.orderId)}&email=${encodeURIComponent(data.email)}`);
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <div>
        <label className="text-sm text-zinc-300">Número de pedido</label>
        <input
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value)}
          placeholder="Ej: 1234"
          className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
        />
      </div>

      <div>
        <label className="text-sm text-zinc-300">Email</label>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="tu@email.com"
          className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
        />
      </div>

      {error ? <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">{error}</div> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {loading ? "Buscando..." : "Ver pedido"}
      </button>
    </form>
  );
}
