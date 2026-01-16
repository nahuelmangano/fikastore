"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminProductEditor({ product }: { product: any }) {
  const [price, setPrice] = useState<number>(Number(product.price));
  const [stock, setStock] = useState<number>(product.stock);
  const [isActive, setIsActive] = useState<boolean>(product.isActive);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const img = product.images?.[0]?.url ?? "https://placehold.co/600x600/png?text=Fika";

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/admin/products" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Volver
        </Link>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex gap-4">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={product.name} className="h-full w-full object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{product.name}</h1>
              <div className="mt-1 text-xs font-mono text-zinc-500">{product.slug}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm text-zinc-300">Precio (ARS)</label>
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-300">Stock</label>
              <input
                type="number"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <input
              id="active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="active" className="text-sm text-zinc-300">
              Producto activo (visible en tienda)
            </label>
          </div>

          {msg && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-200">
              {msg}
            </div>
          )}

          <button
            disabled={loading}
            onClick={async () => {
              setMsg(null);
              setLoading(true);

              const res = await fetch(`/api/admin/products/${product.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ price, stock, isActive }),
              });

              const data = await res.json().catch(() => ({}));
              setLoading(false);

              if (!res.ok) {
                setMsg(data?.error || "Error guardando cambios.");
                return;
              }

              setMsg("✅ Cambios guardados.");
            }}
            className="mt-6 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </main>
  );
}
