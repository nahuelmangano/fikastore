"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { slugify } from "@/lib/slug";

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
}

function variantLabel(name: string) {
  const { variantName } = splitProductName(name);
  return variantName || "Única variante";
}

type ProductImage = {
  id: string;
  url: string;
  sortOrder?: number;
};

type EditableProduct = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  price: unknown;
  stock: number;
  isActive: boolean;
  images?: ProductImage[];
};

export default function AdminProductEditor({
  product,
  variants,
}: {
  product: EditableProduct;
  variants: EditableProduct[];
}) {
  const [items, setItems] = useState<EditableProduct[]>(variants);
  const [selectedId, setSelectedId] = useState(product.id);
  const selected = items.find((item) => item.id === selectedId) ?? product;
  const { baseName } = splitProductName(product.name);

  const [name, setName] = useState<string>(selected.name);
  const [slug, setSlug] = useState<string>(selected.slug);
  const [description, setDescription] = useState<string>(selected.description ?? "");
  const [price, setPrice] = useState<number>(Number(selected.price));
  const [stock, setStock] = useState<number>(selected.stock);
  const [isActive, setIsActive] = useState<boolean>(selected.isActive);
  const [images, setImages] = useState<ProductImage[]>(selected.images ?? []);

  const mainImg = useMemo(() => images?.[0]?.url, [images]);
  const totalStock = items.reduce((acc, item) => acc + Number(item.stock || 0), 0);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function selectVariant(item: EditableProduct) {
    setSelectedId(item.id);
    setName(item.name);
    setSlug(item.slug);
    setDescription(item.description ?? "");
    setPrice(Number(item.price));
    setStock(item.stock);
    setIsActive(item.isActive);
    setImages(item.images ?? []);
    setMsg(null);
  }

  function patchSelected(next: Partial<EditableProduct>) {
    setItems((prev) => prev.map((item) => (item.id === selected.id ? { ...item, ...next } : item)));
  }

  async function save() {
    setMsg(null);
    setLoading(true);

    const res = await fetch(`/api/admin/products/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, price, stock, isActive }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "Error guardando cambios."));
      return;
    }

    patchSelected({ name, slug, description: description || null, price, stock, isActive, images });
    setMsg("Cambios guardados.");
  }

  async function upload(file: File) {
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch(`/api/admin/products/${selected.id}/images`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(data?.error || "Error subiendo imagen."));
      return;
    }

    const nextImages = [...images, data.image as ProductImage];
    setImages(nextImages);
    patchSelected({ images: nextImages });
    setMsg("Imagen agregada.");
  }

  async function removeImage(imageId: string) {
    setMsg(null);
    const res = await fetch(`/api/admin/products/${selected.id}/images/${imageId}`, {
      method: "DELETE",
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(data?.error || "Error borrando imagen."));
      return;
    }

    const nextImages = images.filter((x) => x.id !== imageId);
    setImages(nextImages);
    patchSelected({ images: nextImages });
    setMsg("Imagen borrada.");
  }

  async function deleteProduct() {
    const ok = confirm(`¿Seguro que querés borrar esta variante?
${name}

No se puede deshacer.`);
    if (!ok) return;

    const res = await fetch(`/api/admin/products/${selected.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(String(data?.error || "No se pudo borrar."));
      return;
    }

    const remaining = items.filter((item) => item.id !== selected.id);
    if (remaining.length === 0) {
      window.location.href = "/admin/products";
      return;
    }

    setItems(remaining);
    selectVariant(remaining[0]);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <Link href="/admin/products" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Volver
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/products/${slug}`}
              className="rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900/60"
            >
              Ver en tienda
            </Link>

            <button
              onClick={deleteProduct}
              className="rounded-xl border border-red-900/40 bg-red-900/20 px-3 py-2 text-sm text-red-200 hover:bg-red-900/30"
            >
              Borrar variante
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="text-xs uppercase tracking-wider text-zinc-500">Producto</div>
            <h1 className="mt-1 text-xl font-semibold">{baseName}</h1>
            <div className="mt-1 text-sm text-zinc-400">
              {items.length} variante{items.length === 1 ? "" : "s"} · Stock total {totalStock}
            </div>

            <div className="mt-5 space-y-2">
              {items.map((item) => {
                const active = item.id === selected.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectVariant(item)}
                    className={[
                      "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                      active
                        ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900/60",
                    ].join(" ")}
                  >
                    <span className="block truncate font-medium">{variantLabel(item.name)}</span>
                    <span className={active ? "text-xs text-zinc-600" : "text-xs text-zinc-500"}>
                      Stock {item.stock} · ${Number(item.price).toLocaleString("es-AR")}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <div className="flex gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mainImg ?? "https://placehold.co/600x600/png?text=Fika"}
                  alt={name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{variantLabel(name)}</h2>
                <div className="mt-1 text-sm text-zinc-400">{baseName}</div>
                <div className="mt-1 text-xs font-mono text-zinc-500">{selected.id}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div>
                <label className="text-sm text-zinc-300">Nombre de la variante</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                />
              </div>

              <div>
                <label className="text-sm text-zinc-300">Slug</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
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

              <div className="mt-2 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Imágenes de esta variante</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Guardadas localmente en <span className="font-mono">public/uploads</span>
                    </div>
                  </div>

                  <label className="cursor-pointer rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
                    + Subir imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) upload(f);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {images.length === 0 ? (
                  <div className="mt-4 text-sm text-zinc-400">Todavía no hay imágenes.</div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {images.map((im) => (
                      <div key={im.id} className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-2">
                        <div className="aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={im.url} alt={name} className="h-full w-full object-cover" />
                        </div>
                        <button
                          onClick={() => removeImage(im.id)}
                          className="mt-2 w-full rounded-lg border border-red-900/40 bg-red-900/20 px-2 py-1 text-xs text-red-200 hover:bg-red-900/30"
                        >
                          Borrar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {msg && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-200">
                  {msg}
                </div>
              )}

              <button
                disabled={loading}
                onClick={save}
                className="mt-2 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Guardar variante"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
