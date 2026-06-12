"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { slugify } from "@/lib/slug";
import { sanitizeRichText } from "@/lib/richText";

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
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  name: string;
  slug: string;
  description?: string | null;
  price: unknown;
  stock: number;
  isActive: boolean;
  images?: ProductImage[];
};

type CategoryOption = {
  id: string;
  name: string;
};

const FONT_OPTIONS = [
  { label: "Sans", value: "Arial" },
  { label: "Serif", value: "Georgia" },
  { label: "Mono", value: "Courier New" },
  { label: "Elegante", value: "Times New Roman" },
];

export default function AdminProductEditor({
  product,
  variants,
  categories,
}: {
  product: EditableProduct;
  variants: EditableProduct[];
  categories: CategoryOption[];
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
  const [categoryId, setCategoryId] = useState<string>(selected.categoryId ?? "");
  const [images, setImages] = useState<ProductImage[]>(selected.images ?? []);

  const mainImg = useMemo(() => images?.[0]?.url, [images]);
  const totalStock = items.reduce((acc, item) => acc + Number(item.stock || 0), 0);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!descriptionRef.current) return;
    descriptionRef.current.innerHTML = sanitizeRichText(selected.description);
  }, [selected.id, selected.description]);

  function selectVariant(item: EditableProduct) {
    setSelectedId(item.id);
    setName(item.name);
    setSlug(item.slug);
    setDescription(item.description ?? "");
    setPrice(Number(item.price));
    setStock(item.stock);
    setIsActive(item.isActive);
    setCategoryId(item.categoryId ?? "");
    setImages(item.images ?? []);
    setMsg(null);
  }

  function patchSelected(next: Partial<EditableProduct>) {
    setItems((prev) => prev.map((item) => (item.id === selected.id ? { ...item, ...next } : item)));
  }

  function syncDescriptionFromEditor() {
    setDescription(sanitizeRichText(descriptionRef.current?.innerHTML ?? ""));
  }

  function formatDescription(command: string, value?: string) {
    descriptionRef.current?.focus();
    document.execCommand(command, false, value);
    syncDescriptionFromEditor();
  }

  async function save() {
    setMsg(null);
    setLoading(true);

    const res = await fetch(`/api/admin/products/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, price, stock, isActive, categoryId }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "Error guardando cambios."));
      return;
    }

    const category = categories.find((item) => item.id === categoryId) ?? null;
    patchSelected({ name, slug, description: description || null, price, stock, isActive, categoryId, category, images });
    setMsg("Cambios guardados.");
  }

  async function upload(file: File) {
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    for (const item of items) {
      fd.append("productIds", item.id);
    }

    const res = await fetch(`/api/admin/products/${selected.id}/images`, {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(data?.error || "Error subiendo imagen."));
      return;
    }

    const uploadedImages = Array.isArray(data.images) ? (data.images as Array<ProductImage & { productId?: string }>) : [];
    const selectedImage =
      uploadedImages.find((image) => image.productId === selected.id) ?? (data.image as ProductImage | undefined);

    if (!selectedImage) {
      setMsg("Imagen subida, pero no se pudo actualizar la vista.");
      return;
    }

    const nextImages = [...images, selectedImage];
    setImages(nextImages);
    setItems((prev) =>
      prev.map((item) => {
        const image = uploadedImages.find((uploaded) => uploaded.productId === item.id);
        if (!image) return item;
        return { ...item, images: [...(item.images ?? []), image] };
      })
    );
    setMsg(`Imagen agregada a ${uploadedImages.length || items.length} variante(s).`);
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

    if (data?.mode === "deactivated") {
      const nextProduct = {
        ...selected,
        isActive: false,
        stock: 0,
      };
      setIsActive(false);
      setStock(0);
      setItems((prev) => prev.map((item) => (item.id === selected.id ? nextProduct : item)));
      setMsg(String(data?.message || "La variante tiene pedidos asociados. Se desactivó."));
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
              className="rounded-xl border border-red-700 bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
                    <span className={active ? "block truncate text-xs text-zinc-600" : "block truncate text-xs text-zinc-500"}>
                      {item.category?.name ?? "Sin categoria"}
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

                    <select
                      defaultValue=""
                      onChange={(event) => {
                        if (!event.target.value) return;
                        formatDescription("fontName", event.target.value);
                        event.target.value = "";
                      }}
                      className="h-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-sm"
                    >
                      <option value="">Tipografía</option>
                      {FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}
                    </select>

                    <label className="flex h-8 items-center gap-2 rounded-lg border border-zinc-800 px-2 text-sm">
                      Color
                      <input
                        type="color"
                        defaultValue="#8a4f1d"
                        onChange={(event) => formatDescription("foreColor", event.target.value)}
                        className="h-5 w-8 border-0 bg-transparent p-0"
                      />
                    </label>
                  </div>

                  <div
                    key={selected.id}
                    ref={descriptionRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={syncDescriptionFromEditor}
                    className="min-h-28 w-full px-3 py-2 text-sm leading-6 outline-none"
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
                      {category.name}
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
                    <div className="text-sm font-semibold">Imágenes de este productos</div>
                   
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
                          className="mt-2 w-full rounded-lg border border-red-700 bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
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
                {loading ? "Guardando..." : "Guardar Producto"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
