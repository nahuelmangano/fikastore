"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { sanitizeRichText } from "@/lib/richText";
import ConfirmDialog from "@/components/admin/feedback/ConfirmDialog";

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
  productId?: string;
  url: string;
  sortOrder?: number;
  visible?: boolean;
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
  parentId?: string | null;
  name: string;
  label?: string;
};

const FONT_OPTIONS = [
  { label: "Sans", value: "Arial" },
  { label: "Serif", value: "Georgia" },
  { label: "Mono", value: "Courier New" },
  { label: "Elegante", value: "Times New Roman" },
];

const TEXT_COLOR_OPTIONS = [
  { label: "Negro", value: "#1f1309" },
  { label: "Marca", value: "#8a4f1d" },
  { label: "Rojo", value: "#dc2626" },
  { label: "Verde", value: "#15803d" },
  { label: "Azul", value: "#2563eb" },
  { label: "Gris", value: "#525252" },
];

export default function AdminProductEditor({
  product,
  variants,
  categories,
  backHref,
}: {
  product: EditableProduct;
  variants: EditableProduct[];
  categories: CategoryOption[];
  backHref: string;
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
  const [newVariantName, setNewVariantName] = useState("");
  const [newVariantStock, setNewVariantStock] = useState(0);
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [imageToRemove, setImageToRemove] = useState<ProductImage | null>(null);
  const [imageUrlToRemoveFromAll, setImageUrlToRemoveFromAll] = useState<string | null>(null);
  const [removingImage, setRemovingImage] = useState(false);
  const [removingImageFromAll, setRemovingImageFromAll] = useState(false);

  const mainImg = useMemo(() => images?.[0]?.url, [images]);
  const totalStock = items.reduce((acc, item) => acc + Number(item.stock || 0), 0);
  const availableImageUrls = useMemo(
    () => Array.from(new Set(items.flatMap((item) => (item.images ?? []).map((image) => image.url)))),
    [items]
  );
  const imageTiles = useMemo(() => {
    const activeUrls = new Set(images.map((image) => image.url));
    return [...images.map((image) => image.url), ...availableImageUrls.filter((url) => !activeUrls.has(url))];
  }, [availableImageUrls, images]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const descriptionInitializedRef = useRef(false);

  useEffect(() => {
    if (!descriptionRef.current || descriptionInitializedRef.current) return;
    descriptionRef.current.innerHTML = sanitizeRichText(description);
    descriptionInitializedRef.current = true;
  }, [description]);

  function selectVariant(item: EditableProduct) {
    setSelectedId(item.id);
    setName(item.name);
    setSlug(item.slug);
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

  function imageVisibleInAllVariants(url: string) {
    return items.length > 0 && items.every((item) => (item.images ?? []).some((image) => image.url === url && image.visible !== false));
  }

  function mergeImages(existingImages: ProductImage[], incomingImages: ProductImage[]) {
    const incomingByKey = new Map(incomingImages.flatMap((image) => [[image.id, image], [image.url, image]]));
    const merged = existingImages.map((image) => incomingByKey.get(image.id) ?? incomingByKey.get(image.url) ?? image);
    const mergedKeys = new Set(merged.flatMap((image) => [image.id, image.url]));
    return [...merged, ...incomingImages.filter((image) => !mergedKeys.has(image.id) && !mergedKeys.has(image.url))];
  }

  function applyUploadedImages(uploadedImages: Array<ProductImage & { productId?: string }>) {
    const selectedImages = uploadedImages.filter((image) => image.productId === selected.id);
    const nextImages = selectedImages.length > 0 ? mergeImages(images, selectedImages) : images;

    if (selectedImages.length > 0) setImages(nextImages);

    setItems((prev) =>
      prev.map((item) => {
        const itemImages = uploadedImages.filter((uploaded) => uploaded.productId === item.id);
        if (itemImages.length === 0) return item;
        return {
          ...item,
          images: mergeImages(item.images ?? [], itemImages),
        };
      })
    );
  }

  async function saveImageOrder(nextImages: ProductImage[]) {
    const orderedImages = nextImages.map((image, index) => ({ ...image, sortOrder: index + 1 }));
    setImages(orderedImages);
    patchSelected({ images: orderedImages });

    const res = await fetch(`/api/admin/products/${selected.id}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageIds: orderedImages.map((image) => image.id),
        imageUrls: orderedImages.map((image) => image.url),
        productIds: items.map((item) => item.id),
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo guardar el orden de las imagenes."));
      return;
    }

    const savedImages = Array.isArray(data.images) ? (data.images as ProductImage[]) : orderedImages;
    setImages(savedImages);
    patchSelected({ images: savedImages });
    if (Array.isArray(data.allImages)) {
      const allImages = data.allImages as Array<ProductImage & { productId?: string }>;
      setItems((prev) =>
        prev.map((item) => {
          const itemImages = allImages.filter((image) => image.productId === item.id);
          return itemImages.length > 0 ? { ...item, images: itemImages } : item;
        })
      );
    }
    setMsg("Orden de imagenes actualizado.");
  }

  function dropImageOn(targetImageId: string) {
    if (!draggedImageId || draggedImageId === targetImageId) return;

    const from = images.findIndex((image) => image.id === draggedImageId);
    const to = images.findIndex((image) => image.id === targetImageId);
    if (from < 0 || to < 0) return;

    const nextImages = [...images];
    const [moved] = nextImages.splice(from, 1);
    nextImages.splice(to, 0, moved);
    setDraggedImageId(null);
    void saveImageOrder(nextImages);
  }

  function syncDescriptionFromEditor() {
    setDescription(sanitizeRichText(descriptionRef.current?.innerHTML ?? ""));
  }

  function formatDescription(command: string, value?: string) {
    descriptionRef.current?.focus();
    document.execCommand(command, false, value);
    syncDescriptionFromEditor();
  }

  function clearDescriptionFormatting() {
    const editor = descriptionRef.current;
    if (!editor) return;

    const lines = editor.innerText.split(/\r?\n/);
    editor.replaceChildren();
    lines.forEach((line, index) => {
      if (index > 0) editor.appendChild(document.createElement("br"));
      editor.appendChild(document.createTextNode(line));
    });
    editor.focus();
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

  async function save() {
    setMsg(null);
    setLoading(true);

    const res = await fetch(`/api/admin/products/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug,
        description,
        price,
        stock,
        isActive,
        categoryId,
        variantIds: items.map((item) => item.id),
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "Error guardando cambios."));
      return;
    }

    const category = categories.find((item) => item.id === categoryId) ?? null;
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== selected.id) return { ...item, description: description || null, price, categoryId, category };
        return { ...item, name, slug, description: description || null, price, stock, isActive, categoryId, category, images };
      })
    );
    setMsg("Cambios guardados.");
  }

  async function upload(files: File[]) {
    setMsg(null);
    const fd = new FormData();
    for (const file of files) {
      fd.append("file", file);
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
    const selectedImages = uploadedImages.filter((image) => image.productId === selected.id);
    const fallbackImage = data.image as ProductImage | undefined;

    if (selectedImages.length === 0 && !fallbackImage) {
      setMsg("Imagenes subidas, pero no se pudo actualizar la vista.");
      return;
    }

    applyUploadedImages(selectedImages.length > 0 ? uploadedImages : [{ ...(fallbackImage as ProductImage), productId: selected.id }]);
    setMsg(`${files.length === 1 ? "Imagen agregada" : "Imagenes agregadas"} a esta variante.`);
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

  async function confirmRemoveImage() {
    if (!imageToRemove) return;

    setRemovingImage(true);
    await removeImage(imageToRemove.id);
    setRemovingImage(false);
    setImageToRemove(null);
  }

  async function confirmRemoveImageFromAllVariants() {
    if (!imageUrlToRemoveFromAll) return;

    setMsg(null);
    setRemovingImageFromAll(true);

    const targets = items
      .map((item) => ({ item, image: (item.images ?? []).find((image) => image.url === imageUrlToRemoveFromAll) }))
      .filter((entry): entry is { item: EditableProduct; image: ProductImage } => Boolean(entry.image));

    for (const { item, image } of targets) {
      const res = await fetch(`/api/admin/products/${item.id}/images/${image.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(String(data?.error || "No se pudo eliminar la imagen de todas las variantes."));
        setRemovingImageFromAll(false);
        return;
      }
    }

    setImages((prev) => prev.filter((image) => image.url !== imageUrlToRemoveFromAll));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        images: (item.images ?? []).filter((image) => image.url !== imageUrlToRemoveFromAll),
      }))
    );
    setMsg("Imagen eliminada de todas las variantes.");
    setRemovingImageFromAll(false);
    setImageUrlToRemoveFromAll(null);
  }

  async function toggleVariantImage(url: string, enabled: boolean) {
    setMsg(null);
    const existingImage = images.find((item) => item.url === url);

    if (existingImage) {
      const res = await fetch(`/api/admin/products/${selected.id}/images/${existingImage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: enabled }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(String(data?.error || "No se pudo cambiar la visibilidad de la imagen."));
        return;
      }

      const updatedImage = (data.image as ProductImage | undefined) ?? { ...existingImage, visible: enabled };
      const nextImages = images.map((item) => (item.id === existingImage.id ? updatedImage : item));
      setImages(nextImages);
      patchSelected({ images: nextImages });
      setMsg(enabled ? "Imagen visible para esta variante." : "Imagen ocultada para esta variante.");
      return;
    }

    if (enabled) {
      const res = await fetch(`/api/admin/products/${selected.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.image) {
        setMsg(String(data?.error || "No se pudo activar la imagen."));
        return;
      }

      const image = data.image as ProductImage;
      const nextImages = images.some((item) => item.id === image.id || item.url === image.url) ? images : [...images, image];
      setImages(nextImages);
      patchSelected({ images: nextImages });
      setMsg("Imagen activada para esta variante.");
      return;
    }
  }

  async function toggleAllVariantsImage(url: string, enabled: boolean) {
    setMsg(null);

    if (enabled) {
      const res = await fetch(`/api/admin/products/${selected.id}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, productIds: items.map((item) => item.id) }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !Array.isArray(data.images)) {
        setMsg(String(data?.error || "No se pudo mostrar la imagen en todas las variantes."));
        return;
      }

      applyUploadedImages(data.images as Array<ProductImage & { productId?: string }>);
      setMsg("Imagen visible en todas las variantes.");
      return;
    }

    const visibilityUpdates = items
      .filter((item) => item.id !== selected.id)
      .map((item) => ({ item, image: (item.images ?? []).find((image) => image.url === url) }))
      .filter((entry): entry is { item: EditableProduct; image: ProductImage } => Boolean(entry.image));

    for (const { item, image } of visibilityUpdates) {
      const res = await fetch(`/api/admin/products/${item.id}/images/${image.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visible: enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(String(data?.error || "No se pudo cambiar la visibilidad en todas las variantes."));
        return;
      }
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === selected.id) return item;
        return {
          ...item,
          images: (item.images ?? []).map((image) => (image.url === url ? { ...image, visible: enabled } : image)),
        };
      })
    );
    setMsg(enabled ? "Imagen visible en todas las variantes." : "Imagen oculta en las otras variantes.");
  }

  async function createVariant() {
    const variantName = newVariantName.trim();
    if (!variantName) {
      setAddVariantOpen(true);
      setMsg("Ingresá el nombre de la variante.");
      return;
    }

    setMsg(null);
    setAddingVariant(true);

    const res = await fetch(`/api/admin/products/${selected.id}/variants`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantName,
        stock: newVariantStock,
        description,
        price,
        categoryId,
        isActive,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setAddingVariant(false);

    if (!res.ok || !data?.product) {
      setMsg(String(data?.error || "No se pudo crear la variante."));
      return;
    }

    const nextProduct = data.product as EditableProduct;
    setItems((prev) => [...prev, nextProduct]);
    setNewVariantName("");
    setNewVariantStock(0);
    setAddVariantOpen(false);
    selectVariant(nextProduct);
    setMsg("Variante creada.");
  }

  async function deleteVariant(target: EditableProduct = selected) {
    const ok = confirm(`¿Seguro que querés borrar esta variante?
${target.name}

No se puede deshacer.`);
    if (!ok) return;

    const res = await fetch(`/api/admin/products/${target.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(String(data?.error || "No se pudo borrar."));
      return;
    }

    if (data?.mode === "deactivated") {
      const nextProduct = {
        ...target,
        isActive: false,
        stock: 0,
      };
      if (target.id === selected.id) {
        setIsActive(false);
        setStock(0);
      }
      setItems((prev) => prev.map((item) => (item.id === target.id ? nextProduct : item)));
      setMsg(String(data?.message || "La variante tiene pedidos asociados. Se desactivó."));
      return;
    }

    const remaining = items.filter((item) => item.id !== target.id);
    if (remaining.length === 0) {
      window.location.href = backHref;
      return;
    }

    setItems(remaining);
    if (target.id === selected.id) selectVariant(remaining[0]);
  }

  async function deleteWholeProduct() {
    const ok = confirm(`Â¿Seguro que querÃ©s borrar el producto completo?
${baseName}

Esto borrarÃ¡ todas sus variantes. No se puede deshacer.`);
    if (!ok) return;

    const res = await fetch(`/api/admin/products/${selected.id}?scope=group`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(String(data?.error || "No se pudo borrar el producto."));
      return;
    }

    if (data?.mode === "deactivated") {
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          isActive: false,
          stock: 0,
        }))
      );
      setIsActive(false);
      setStock(0);
      setMsg(String(data?.message || "El producto tiene pedidos asociados. Se desactivaron todas las variantes."));
      return;
    }

    window.location.href = backHref;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <Link href={backHref} className="text-sm text-zinc-400 hover:text-zinc-200">
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
              onClick={deleteWholeProduct}
              className="rounded-xl border border-red-600 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Borrar producto
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
                  <div
                    key={item.id}
                    className={[
                      "flex w-full items-start gap-2 rounded-xl border p-2 text-sm transition",
                      active
                        ? "border-[#925b23] bg-[#925b23] text-white"
                        : "border-zinc-800 bg-zinc-950/60 text-zinc-200 hover:bg-zinc-900/60",
                    ].join(" ")}
                  >
                    <button type="button" onClick={() => selectVariant(item)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium">{variantLabel(item.name)}</span>
                    <span className={active ? "text-xs text-white/85" : "text-xs text-zinc-500"}>
                      Stock {item.stock} · ${Number(item.price).toLocaleString("es-AR")}
                    </span>
                    <span className={active ? "block truncate text-xs text-white/75" : "block truncate text-xs text-zinc-500"}>
                      {item.category?.name ?? "Sin categoria"}
                    </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVariant(item)}
                      title="Borrar variante"
                      aria-label={`Borrar variante ${variantLabel(item.name)}`}
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition",
                        active
                          ? "border-white/30 text-white hover:bg-white/15"
                          : "border-red-200 bg-white text-red-700 hover:bg-red-50",
                      ].join(" ")}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v5" />
                        <path d="M14 11v5" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40">
              <button
                type="button"
                onClick={() => setAddVariantOpen((open) => !open)}
                aria-expanded={addVariantOpen}
                className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold"
              >
                <span>Agregar variante</span>
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={["h-4 w-4 transition", addVariantOpen ? "rotate-180" : ""].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {addVariantOpen && (
                <div className="grid gap-3 border-t border-zinc-800 px-3 py-3">
                  <div>
                    <label className="text-xs text-zinc-400">Nombre</label>
                    <input
                      value={newVariantName}
                      onChange={(event) => setNewVariantName(event.target.value)}
                      placeholder="Ej: Talle: XXL"
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-400">Stock</label>
                    <input
                      type="number"
                      value={newVariantStock}
                      onChange={(event) => setNewVariantStock(Number(event.target.value))}
                      className="mt-1 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={createVariant}
                    disabled={addingVariant}
                    className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                  >
                    {addingVariant ? "Creando..." : "Crear variante"}
                  </button>
                </div>
              )}
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

                    <div className="flex h-8 items-center gap-1 rounded-lg border border-zinc-800 px-2">
                      <span className="mr-1 text-sm">Color</span>
                      {TEXT_COLOR_OPTIONS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => formatDescription("foreColor", color.value)}
                          title={color.label}
                          aria-label={`Color ${color.label}`}
                          className="h-5 w-5 rounded-full border border-zinc-700 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                          style={{ backgroundColor: color.value }}
                        />
                      ))}
                      <label
                        title="Otro color"
                        className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-zinc-700 text-[10px] font-semibold transition hover:scale-110 focus-within:ring-2 focus-within:ring-zinc-300"
                      >
                        +
                        <input
                          type="color"
                          defaultValue="#8a4f1d"
                          onChange={(event) => formatDescription("foreColor", event.target.value)}
                          className="sr-only"
                          aria-label="Elegir otro color"
                        />
                      </label>
                    </div>

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

                    <button
                      type="button"
                      onClick={clearDescriptionFormatting}
                      className="h-8 rounded-lg border border-zinc-800 px-2 text-sm hover:bg-zinc-900/60"
                    >
                      Limpiar formato
                    </button>
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
                      Activá las imágenes que deben mostrarse para {variantLabel(name)}.
                    </div>
                  </div>

                  <label className="cursor-pointer rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
                    + Subir a esta variante
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        if (files.length > 0) upload(files);
                        e.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>

                {imageTiles.length === 0 ? (
                  <div className="mt-4 text-sm text-zinc-400">Todavía no hay imágenes disponibles.</div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {imageTiles.map((url) => {
                      const activeImage = images.find((image) => image.url === url);
                      const active = Boolean(activeImage && activeImage.visible !== false);
                      const visibleInAll = imageVisibleInAllVariants(url);
                      return (
                      <div
                        key={url}
                        draggable={active}
                        onDragStart={() => activeImage && setDraggedImageId(activeImage.id)}
                        onDragEnd={() => setDraggedImageId(null)}
                        onDragOver={(event) => {
                          if (!active) return;
                          event.preventDefault();
                        }}
                        onDrop={() => activeImage && dropImageOn(activeImage.id)}
                        className={[
                          "rounded-xl border bg-zinc-900/30 p-2",
                          active ? "border-zinc-200" : "border-zinc-800 opacity-60",
                          active ? "cursor-move" : "",
                          draggedImageId === activeImage?.id ? "opacity-40" : "",
                        ].join(" ")}
                      >
                        <div>
                          <div className="aspect-square overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt={name} className="h-full w-full object-cover" />
                          </div>
                          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                            <input
                              type="checkbox"
                              checked={active}
                              onChange={(event) => void toggleVariantImage(url, event.target.checked)}
                            />
                            Mostrar
                          </label>
                          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
                            <input
                              type="checkbox"
                              checked={visibleInAll}
                              onChange={(event) => toggleAllVariantsImage(url, event.target.checked)}
                            />
                            Mostrar en todas
                          </label>
                        </div>
                        {activeImage && (
                          <button
                            type="button"
                            onClick={() => setImageToRemove(activeImage)}
                            className="mt-2 w-full rounded-lg border border-red-700 bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700"
                          >
                            Quitar de variante
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setImageUrlToRemoveFromAll(url)}
                          className="mt-2 w-full rounded-lg border border-red-800 bg-red-900 px-2 py-1 text-xs font-semibold text-white hover:bg-red-950"
                        >
                          Eliminar de todas las variantes
                        </button>
                      </div>
                      );
                    })}
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
      <ConfirmDialog
        open={Boolean(imageToRemove)}
        title="Quitar imagen de la variante"
        description="La imagen dejará de mostrarse en esta variante. Si está activa en otras variantes, seguirá disponible allí."
        confirmLabel="Quitar imagen"
        cancelLabel="Cancelar"
        variant="danger"
        loading={removingImage}
        onConfirm={() => void confirmRemoveImage()}
        onCancel={() => {
          if (!removingImage) setImageToRemove(null);
        }}
      />
      <ConfirmDialog
        open={Boolean(imageUrlToRemoveFromAll)}
        title="Eliminar imagen de todas las variantes"
        description="La imagen se quitará de todas las variantes de este producto. No se puede deshacer desde esta pantalla."
        confirmLabel="Eliminar de todas"
        cancelLabel="Cancelar"
        variant="danger"
        loading={removingImageFromAll}
        onConfirm={() => void confirmRemoveImageFromAllVariants()}
        onCancel={() => {
          if (!removingImageFromAll) setImageUrlToRemoveFromAll(null);
        }}
      />
    </main>
  );
}
