"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { slugify } from "@/lib/slug";
import { sanitizeRichText } from "@/lib/richText";

type CategoryOption = {
  id: string;
  parentId?: string | null;
  name: string;
  label?: string;
};

type DraftVariant = {
  id: string;
  name: string;
  stock: number;
};

function newVariant(name = "", stock = 0): DraftVariant {
  return {
    id: Math.random().toString(36).slice(2),
    name,
    stock,
  };
}

export default function AdminProductCreate({ categories }: { categories: CategoryOption[] }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(1000);
  const [variants, setVariants] = useState<DraftVariant[]>([newVariant()]);
  const [isActive, setIsActive] = useState(true);
  const [categoryId, setCategoryId] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);

  function syncDescriptionFromEditor() {
    setDescription(sanitizeRichText(descriptionRef.current?.innerHTML ?? ""));
  }

  function formatDescription(command: string, value?: string) {
    descriptionRef.current?.focus();
    document.execCommand(command, false, value);
    syncDescriptionFromEditor();
  }

  async function uploadDescriptionImage(file: File) {
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/uploads/image", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) {
      setMsg(String(data?.error || "Error subiendo imagen para la descripcion."));
      return;
    }

    descriptionRef.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${data.url}" alt="" loading="lazy"><br>`);
    syncDescriptionFromEditor();
  }

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
                  setSlug(slugify(v));
                }}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-zinc-300">Descripción</label>
              <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => formatDescription("bold")}
                    className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm font-bold hover:bg-zinc-900/60"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDescription("italic")}
                    className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm italic hover:bg-zinc-900/60"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => formatDescription("underline")}
                    className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm underline hover:bg-zinc-900/60"
                  >
                    U
                  </button>
                  <label className="flex h-8 cursor-pointer items-center rounded-lg border border-zinc-800 px-2 text-sm hover:bg-zinc-900/60">
                    Imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadDescriptionImage(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <div
                  ref={descriptionRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncDescriptionFromEditor}
                  className="min-h-28 w-full px-3 py-2 text-sm leading-6 outline-none [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-300">Categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              >
                <option value="">Sin categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label ?? category.name}
                  </option>
                ))}
              </select>
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
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Variantes</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Dejá el nombre vacío si el producto no tiene variantes.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setVariants((prev) => [...prev, newVariant()])}
                  className="rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900/60"
                >
                  + Agregar variante
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {variants.map((variant, index) => (
                  <div key={variant.id} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-3 sm:grid-cols-[1fr_140px_auto]">
                    <div>
                      <label className="text-xs text-zinc-400">Nombre de variante</label>
                      <input
                        value={variant.name}
                        placeholder={index === 0 ? "Ej: Talle: S" : "Ej: Talle: M"}
                        onChange={(e) => {
                          const value = e.target.value;
                          setVariants((prev) =>
                            prev.map((item) => (item.id === variant.id ? { ...item, name: value } : item))
                          );
                        }}
                        className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400">Stock</label>
                      <input
                        type="number"
                        value={variant.stock}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setVariants((prev) =>
                            prev.map((item) => (item.id === variant.id ? { ...item, stock: value } : item))
                          );
                        }}
                        className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setVariants((prev) => prev.filter((item) => item.id !== variant.id))}
                        disabled={variants.length === 1}
                        className="w-full rounded-xl border border-red-700 bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input checked={isActive} onChange={(e) => setIsActive(e.target.checked)} type="checkbox" />
              Publicado (visible en tienda)
            </label>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Imágenes del producto</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Opcional. Se aplican a todas las variantes creadas.
                  </div>
                </div>

                <label className="cursor-pointer rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900/60">
                  Elegir imágenes
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => setImageFiles(Array.from(event.target.files ?? []))}
                  />
                </label>
              </div>

              {imageFiles.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-zinc-300">
                    {imageFiles.length} imagen{imageFiles.length === 1 ? "" : "es"} seleccionada{imageFiles.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageFiles([])}
                    className="rounded-lg border border-zinc-800 px-2 py-1 text-xs hover:bg-zinc-900/60"
                  >
                    Quitar
                  </button>
                </div>
              )}
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
                  body: JSON.stringify({ name, slug, description, price, variants, isActive, categoryId }),
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                  setLoading(false);
                  setMsg(data?.error || "Error creando producto.");
                  return;
                }

                const createdProducts = Array.isArray(data.products) ? data.products : [data.product];
                const productIds = createdProducts.map((item: { id?: unknown }) => String(item?.id || "")).filter(Boolean);

                if (imageFiles.length > 0 && productIds.length > 0) {
                  const fd = new FormData();
                  for (const file of imageFiles) fd.append("file", file);
                  for (const productId of productIds) fd.append("productIds", productId);

                  const imageRes = await fetch(`/api/admin/products/${data.product.id}/images`, {
                    method: "POST",
                    body: fd,
                  });
                  const imageData = await imageRes.json().catch(() => ({}));

                  if (!imageRes.ok) {
                    setMsg(String(imageData?.error || "Producto creado, pero no se pudieron subir las imágenes."));
                    setLoading(false);
                    return;
                  }
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
