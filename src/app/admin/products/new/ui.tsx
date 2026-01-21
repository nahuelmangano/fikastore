"use client";

import Link from "next/link";
import { useState } from "react";
import { slugify } from "@/lib/slug";

export default function AdminProductCreate() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(1000);
  const [stock, setStock] = useState<number>(0);
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Link href="/admin/products" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Volver
        </Link>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h1 className="text-xl font-semibold">Nuevo producto</h1>

          <div className="mt-6 grid gap-4">
            <div>
              <label className="text-sm text-zinc-300">Nombre</label>
              <input
                value={name}
                onChange={(e) => {
                  const v = e.target.value;
                  setName(v);
                  if (!slugTouched) setSlug(slugify(v));
                }}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-300">Slug</label>
              <input
                value={slug}
                onChange={(e) => {
                  const v = e.target.value;
                  setSlug(slugify(v));
                  setSlugTouched(v.trim().length > 0);
                }}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-300">Descripción</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
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

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input checked={isActive} onChange={(e) => setIsActive(e.target.checked)} type="checkbox" />
              Publicado (visible en tienda)
            </label>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-300">
              Las imágenes se cargan después de crear el producto.
            </div>

            {msg && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
                {msg}
              </div>
            )}

            <button
              disabled={loading}
              onClick={async () => {
                setMsg(null);
                setLoading(true);

                const res = await fetch("/api/admin/products", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, slug, description, price, stock, isActive }),
                });

                const data = await res.json().catch(() => ({}));
                setLoading(false);

                if (!res.ok) {
                  setMsg(data?.error || "Error creando producto.");
                  return;
                }

                window.location.href = `/admin/products/${data.product.id}`;
              }}
              className="mt-2 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Creando..." : "Crear producto"}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
