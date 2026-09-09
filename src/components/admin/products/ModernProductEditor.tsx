"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ChevronDown, GripVertical, Info, Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { slugify } from "@/lib/slug";
import { sanitizeRichText } from "@/lib/richText";
import ConfirmDialog from "@/components/admin/feedback/ConfirmDialog";
import {
  buildVariantDraftsFromOptions,
  normalizeProductOptions,
  PRODUCT_VARIANT_LIMITS,
  validateProductVariantOptions,
} from "@/lib/productVariants";

type CategoryOption = {
  id: string;
  parentId?: string | null;
  name: string;
  label?: string;
};

type ProductImage = {
  id: string;
  url: string;
};

type PendingImage = {
  key: string;
  file: File;
  name: string;
  url: string;
};

type AssignableImage = {
  key: string;
  id?: string;
  url: string;
  name: string;
  pending: boolean;
};

type ExistingProduct = {
  id?: string;
  name: string;
  sku?: string | null;
  slug: string;
  description?: string | null;
  price: number;
  stock: number;
  isActive: boolean;
  categoryId?: string | null;
  images?: ProductImage[];
  hasVariants?: boolean;
};

type ExistingOption = {
  id: string;
  name: string;
  values: Array<{ id: string; value: string }>;
};

type ExistingVariant = {
  id: string;
  label: string;
  sku?: string | null;
  stock: number;
  priceOverride?: number | null;
  optionValueIds: string[];
  imageIds?: string[];
};

type SavedVariantSummary = {
  id: string;
  combinationKey: string;
  label: string;
  optionValueIds: string[];
};

type OptionDraftValue = {
  id?: string;
  clientKey: string;
  value: string;
};

type OptionDraft = {
  id?: string;
  clientKey: string;
  name: string;
  values: OptionDraftValue[];
};

type VariantDraft = {
  id?: string;
  combinationKey: string;
  label: string;
  optionValueKeys: string[];
  stock: number;
  sku: string;
  priceOverride: string;
  enabled: boolean;
};

let draftKeySequence = 0;

function newClientKey(prefix: string) {
  draftKeySequence += 1;
  return `${prefix}:draft:${draftKeySequence}`;
}

function newOptionDraft(): OptionDraft {
  return {
    clientKey: newClientKey("option"),
    name: "",
    values: [
      { clientKey: newClientKey("value"), value: "" },
    ],
  };
}

function initialOptionDrafts(options: ExistingOption[]) {
  if (options.length === 0) return [newOptionDraft()];
  return options.map((option) => ({
    id: option.id,
    clientKey: option.id,
    name: option.name,
    values: option.values.map((value) => ({
      id: value.id,
      clientKey: value.id,
      value: value.value,
    })),
  }));
}

function initialVariantDrafts(options: OptionDraft[], variants: ExistingVariant[]) {
  const normalizedOptions = normalizeProductOptions(
    options.map((option) => ({
      id: option.id,
      clientKey: option.clientKey,
      name: option.name,
      values: option.values.map((value) => ({
        id: value.id,
        clientKey: value.clientKey,
        value: value.value,
      })),
    }))
  );

  const valueKeyById = new Map<string, string>();
  for (const option of normalizedOptions) {
    for (const value of option.values) {
      if (value.id) valueKeyById.set(value.id, value.tempKey);
    }
  }

  return buildVariantDraftsFromOptions(
    normalizedOptions,
    variants.map((variant) => ({
      id: variant.id,
      stock: variant.stock,
      sku: variant.sku || null,
      priceOverride: variant.priceOverride ?? null,
      optionValueKeys: variant.optionValueIds.map((id) => valueKeyById.get(id)).filter(Boolean) as string[],
    }))
  ).map((variant) => ({
    id: variant.id,
    combinationKey: variant.combinationKey,
    label: variant.label,
    optionValueKeys: variant.optionValueKeys,
    stock: variant.stock,
    sku: variant.sku || "",
    priceOverride: variant.priceOverride === null ? "" : String(variant.priceOverride),
    enabled: variant.enabled,
  }));
}

function initialVariantImageAssignments(variantDrafts: VariantDraft[], variants: ExistingVariant[]) {
  const imageIdsByVariantId = new Map(variants.map((variant) => [variant.id, variant.imageIds ?? []]));
  return Object.fromEntries(
    variantDrafts.map((variant) => [variant.combinationKey, imageIdsByVariantId.get(variant.id || "") ?? []])
  ) as Record<string, string[]>;
}

function createPendingImage(file: File): PendingImage {
  return {
    key: newClientKey("pending-image"),
    file,
    name: file.name,
    url: URL.createObjectURL(file),
  };
}

async function readResponseError(res: Response, fallback: string) {
  const statusLabel = res.status ? ` (HTTP ${res.status})` : "";

  try {
    const raw = await res.text();
    if (!raw.trim()) return `${fallback}${statusLabel}`;

    try {
      const data = JSON.parse(raw) as { error?: unknown; message?: unknown; details?: unknown };
      const detail = [data.error, data.message, data.details]
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .find(Boolean);
      if (detail) return `${detail}${statusLabel}`;
    } catch {
      const compact = raw.replace(/\s+/g, " ").trim();
      if (!compact.startsWith("<!DOCTYPE") && !compact.startsWith("<html")) {
        return `${compact.slice(0, 220)}${statusLabel}`;
      }
    }
  } catch {
    return `${fallback}${statusLabel}`;
  }

  if (res.status >= 500) {
    return `No se pudo guardar el producto por un error interno del servidor${statusLabel}. Lo que cargaste no se perdió, pero este fallo no indica por sí solo que haya un problema en los datos. Intentá nuevamente en unos segundos; si sigue pasando, revisá logs del servidor.`;
  }

  return `${fallback}${statusLabel}`;
}

export default function ModernProductEditor({
  mode,
  product,
  initialOptions,
  initialVariants,
  categories,
  backHref,
}: {
  mode: "create" | "edit";
  product: ExistingProduct;
  initialOptions: ExistingOption[];
  initialVariants: ExistingVariant[];
  categories: CategoryOption[];
  backHref: string;
}) {
  const initialOptionState = initialOptionDrafts(initialOptions);
  const initialVariantState = initialVariantDrafts(initialOptionState, initialVariants);
  const initialVariantImageState = initialVariantImageAssignments(initialVariantState, initialVariants);
  const [name, setName] = useState(product.name);
  const [sku, setSku] = useState(product.sku ?? "");
  const [slug, setSlug] = useState(product.slug);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState<number>(Number(product.price || 0));
  const [stock, setStock] = useState<number>(Number(product.stock || 0));
  const [isActive, setIsActive] = useState(Boolean(product.isActive));
  const [categoryId, setCategoryId] = useState(product.categoryId ?? "");
  const [hasVariants, setHasVariants] = useState(Boolean(product.hasVariants));
  const [options, setOptions] = useState<OptionDraft[]>(initialOptionState);
  const [variantRows, setVariantRows] = useState<VariantDraft[]>(initialVariantState);
  const [variantImageAssignments, setVariantImageAssignments] = useState<Record<string, string[]>>(initialVariantImageState);
  const [selectedVariantImageKey, setSelectedVariantImageKey] = useState<string | null>(initialVariantState[0]?.combinationKey ?? null);
  const [images, setImages] = useState<ProductImage[]>(product.images ?? []);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imageDeleteTarget, setImageDeleteTarget] = useState<ProductImage | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [draggedPendingImageIndex, setDraggedPendingImageIndex] = useState<number | null>(null);
  const [pendingImageDropIndex, setPendingImageDropIndex] = useState<number | null>(null);
  const [draggedSavedImageIndex, setDraggedSavedImageIndex] = useState<number | null>(null);
  const [savedImageDropIndex, setSavedImageDropIndex] = useState<number | null>(null);
  const [draggedVariantImageIndex, setDraggedVariantImageIndex] = useState<number | null>(null);
  const [variantImageDropIndex, setVariantImageDropIndex] = useState<number | null>(null);
  const descriptionRef = useRef<HTMLDivElement | null>(null);
  const descriptionInitializedRef = useRef(false);
  const variantRowsRef = useRef<VariantDraft[]>(variantRows);
  const assignableImages = useMemo<AssignableImage[]>(
    () => [
      ...images.map((image) => ({
        key: image.id,
        id: image.id,
        url: image.url,
        name: image.url.split("/").pop() || "Imagen",
        pending: false,
      })),
      ...pendingImages.map((image) => ({
        key: image.key,
        url: image.url,
        name: image.name,
        pending: true,
      })),
    ],
    [images, pendingImages]
  );

  useEffect(() => {
    if (!descriptionRef.current || descriptionInitializedRef.current) return;
    descriptionRef.current.innerHTML = sanitizeRichText(description);
    descriptionInitializedRef.current = true;
  }, [description]);

  useEffect(() => {
    variantRowsRef.current = variantRows;
  }, [variantRows]);

  useEffect(() => {
    if (!hasVariants) return;
    const normalized = normalizeProductOptions(
      options.map((option) => ({
        id: option.id,
        clientKey: option.clientKey,
        name: option.name,
        values: option.values.map((value) => ({
          id: value.id,
          clientKey: value.clientKey,
          value: value.value,
        })),
      }))
    );
    const drafts = buildVariantDraftsFromOptions(
      normalized,
      variantRowsRef.current.map((variant) => ({
        id: variant.id,
        stock: variant.stock,
        sku: variant.sku || null,
        priceOverride: variant.priceOverride ? Number(variant.priceOverride.replace(",", ".")) : null,
        optionValueKeys: variant.optionValueKeys,
      }))
    ).map((variant) => ({
      id: variant.id,
      combinationKey: variant.combinationKey,
      label: variant.label,
      optionValueKeys: variant.optionValueKeys,
      stock: variant.stock,
      sku: variant.sku || "",
      priceOverride: variant.priceOverride === null ? "" : String(variant.priceOverride),
      enabled: variant.enabled,
    }));
    setVariantRows(drafts);
  }, [hasVariants, options]);

  useEffect(() => {
    const validVariantKeys = new Set(variantRows.map((variant) => variant.combinationKey));
    setVariantImageAssignments((prev) => {
      const next = Object.fromEntries(
        variantRows.map((variant) => [variant.combinationKey, prev[variant.combinationKey] ?? []])
      ) as Record<string, string[]>;
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(next);
      const sameKeys = prevKeys.length === nextKeys.length && nextKeys.every((key) => validVariantKeys.has(key));
      const sameValues = sameKeys && nextKeys.every((key) => (prev[key] ?? []).join("|") === (next[key] ?? []).join("|"));
      return sameValues ? prev : next;
    });

    if (!selectedVariantImageKey || !validVariantKeys.has(selectedVariantImageKey)) {
      setSelectedVariantImageKey(variantRows[0]?.combinationKey ?? null);
    }
  }, [selectedVariantImageKey, variantRows]);

  useEffect(() => {
    const availableImageKeys = new Set(assignableImages.map((image) => image.key));
    setVariantImageAssignments((prev) => {
      let changed = false;
      const next = Object.fromEntries(
        Object.entries(prev).map(([variantKey, imageKeys]) => {
          const filtered = imageKeys.filter((imageKey) => availableImageKeys.has(imageKey));
          if (filtered.length !== imageKeys.length) changed = true;
          return [variantKey, filtered];
        })
      ) as Record<string, string[]>;
      return changed ? next : prev;
    });
  }, [assignableImages]);

  const normalizedOptions = useMemo(
    () =>
      normalizeProductOptions(
        options.map((option) => ({
          id: option.id,
          clientKey: option.clientKey,
          name: option.name,
          values: option.values.map((value) => ({
            id: value.id,
            clientKey: value.clientKey,
            value: value.value,
          })),
        }))
      ),
    [options]
  );

  const variantValidation = useMemo(() => validateProductVariantOptions(normalizedOptions), [normalizedOptions]);
  const visibleVariantRows = useMemo(() => variantRows.filter((variant) => variant.enabled), [variantRows]);
  const hiddenVariantRows = useMemo(() => variantRows.filter((variant) => !variant.enabled), [variantRows]);
  const totalVariantStock = useMemo(
    () => visibleVariantRows.reduce((acc, variant) => acc + Number(variant.stock || 0), 0),
    [visibleVariantRows]
  );
  const selectedVariantForImages = variantRows.find((variant) => variant.combinationKey === selectedVariantImageKey) ?? null;
  const selectedVariantAssignedImages = useMemo(
    () =>
      (variantImageAssignments[selectedVariantImageKey || ""] ?? [])
        .map((imageKey) => assignableImages.find((image) => image.key === imageKey))
        .filter(Boolean) as AssignableImage[],
    [assignableImages, selectedVariantImageKey, variantImageAssignments]
  );

  function syncDescriptionFromEditor() {
    setDescription(sanitizeRichText(descriptionRef.current?.innerHTML ?? ""));
  }

  function formatDescription(command: string) {
    descriptionRef.current?.focus();
    document.execCommand(command, false);
    syncDescriptionFromEditor();
  }

  async function uploadDescriptionImage(file: File) {
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/uploads/image", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) {
      setMsg(String(data?.error || "No se pudo subir la imagen de la descripción."));
      return;
    }
    descriptionRef.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${data.url}" alt="" loading="lazy"><br>`);
    syncDescriptionFromEditor();
  }

  function addOption() {
    if (options.length >= PRODUCT_VARIANT_LIMITS.maxOptions) {
      setMsg(`Máximo ${PRODUCT_VARIANT_LIMITS.maxOptions} opciones.`);
      return;
    }
    setOptions((prev) => [...prev, newOptionDraft()]);
  }

  function addOptionValue(optionClientKey: string) {
    setOptions((prev) =>
      prev.map((option) =>
        option.clientKey === optionClientKey
          ? { ...option, values: [...option.values, { clientKey: newClientKey("value"), value: "" }] }
          : option
      )
    );
  }

  function movePendingImage(fromIndex: number, toIndex: number) {
    setPendingImages((prev) => {
      if (toIndex < 0 || toIndex >= prev.length || fromIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function removePendingImage(index: number) {
    setPendingImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function handlePendingImageDragStart(event: DragEvent<HTMLDivElement>, index: number) {
    setDraggedPendingImageIndex(index);
    setPendingImageDropIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handlePendingImageDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    if (pendingImageDropIndex !== index) setPendingImageDropIndex(index);
    event.dataTransfer.dropEffect = "move";
  }

  function handlePendingImageDrop(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const fallbackIndex = Number(event.dataTransfer.getData("text/plain"));
    const fromIndex = draggedPendingImageIndex ?? (Number.isFinite(fallbackIndex) ? fallbackIndex : null);
    if (fromIndex !== null) movePendingImage(fromIndex, index);
    setDraggedPendingImageIndex(null);
    setPendingImageDropIndex(null);
  }

  function resetPendingImageDragState() {
    setDraggedPendingImageIndex(null);
    setPendingImageDropIndex(null);
  }

  async function persistImageOrder(nextImages: ProductImage[]) {
    if (!product.id) return;
    const res = await fetch(`/api/admin/products/${product.id}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageIds: nextImages.map((image) => image.id) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error || "No se pudo guardar el orden de las imágenes."));
    }
  }

  async function moveSavedImage(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= images.length || fromIndex === toIndex) return;
    const next = [...images];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setImages(next);
    try {
      await persistImageOrder(next);
    } catch (error) {
      setImages(images);
      setMsg(error instanceof Error ? error.message : "No se pudo guardar el orden de las imágenes.");
    }
  }

  function handleSavedImageDragStart(event: DragEvent<HTMLDivElement>, index: number) {
    setDraggedSavedImageIndex(index);
    setSavedImageDropIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleSavedImageDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    if (savedImageDropIndex !== index) setSavedImageDropIndex(index);
    event.dataTransfer.dropEffect = "move";
  }

  async function handleSavedImageDrop(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    const fallbackIndex = Number(event.dataTransfer.getData("text/plain"));
    const fromIndex = draggedSavedImageIndex ?? (Number.isFinite(fallbackIndex) ? fallbackIndex : null);
    if (fromIndex !== null) await moveSavedImage(fromIndex, index);
    setDraggedSavedImageIndex(null);
    setSavedImageDropIndex(null);
  }

  function resetSavedImageDragState() {
    setDraggedSavedImageIndex(null);
    setSavedImageDropIndex(null);
  }

  function toggleVariantImageAssignment(variantKey: string, imageKey: string) {
    setVariantImageAssignments((prev) => {
      const current = prev[variantKey] ?? [];
      const next = current.includes(imageKey)
        ? current.filter((key) => key !== imageKey)
        : [...current, imageKey];
      return { ...prev, [variantKey]: next };
    });
  }

  function moveVariantAssignedImage(variantKey: string, fromIndex: number, toIndex: number) {
    setVariantImageAssignments((prev) => {
      const current = prev[variantKey] ?? [];
      if (toIndex < 0 || toIndex >= current.length || fromIndex === toIndex) return prev;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { ...prev, [variantKey]: next };
    });
  }

  function handleVariantAssignedImageDragStart(event: DragEvent<HTMLDivElement>, index: number) {
    setDraggedVariantImageIndex(index);
    setVariantImageDropIndex(index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
  }

  function handleVariantAssignedImageDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    event.preventDefault();
    if (variantImageDropIndex !== index) setVariantImageDropIndex(index);
    event.dataTransfer.dropEffect = "move";
  }

  function handleVariantAssignedImageDrop(event: DragEvent<HTMLDivElement>, variantKey: string, index: number) {
    event.preventDefault();
    const fallbackIndex = Number(event.dataTransfer.getData("text/plain"));
    const fromIndex = draggedVariantImageIndex ?? (Number.isFinite(fallbackIndex) ? fallbackIndex : null);
    if (fromIndex !== null) moveVariantAssignedImage(variantKey, fromIndex, index);
    setDraggedVariantImageIndex(null);
    setVariantImageDropIndex(null);
  }

  function resetVariantAssignedImageDragState() {
    setDraggedVariantImageIndex(null);
    setVariantImageDropIndex(null);
  }

  async function saveVariantImageAssignments(
    productId: string,
    assignments: Array<{ variantId: string; imageIds: string[] }>
  ) {
    const res = await fetch(`/api/admin/products/${productId}/variant-images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignments }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error || "No se pudieron guardar las fotos por variante."));
    }
  }

  function buildSavedVariantIdMap(savedVariants: SavedVariantSummary[]) {
    const byId = new Map<string, string>();
    const byCombinationKey = new Map<string, string>();
    const byLabel = new Map<string, string>();

    for (const variant of savedVariants) {
      byId.set(variant.id, variant.id);
      byCombinationKey.set(variant.combinationKey, variant.id);
      byLabel.set(variant.label, variant.id);
    }

    return new Map(
      variantRows.map((variant) => {
        const variantId =
          (variant.id ? byId.get(variant.id) : undefined) ??
          byCombinationKey.get(variant.combinationKey) ??
          byLabel.get(variant.label) ??
          "";
        return [variant.combinationKey, variantId];
      })
    );
  }

  async function uploadProductImages(productId: string) {
    if (pendingImages.length === 0) return [] as ProductImage[];
    const fd = new FormData();
    for (const image of pendingImages) fd.append("file", image.file);
    const res = await fetch(`/api/admin/products/${productId}/images`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error || "No se pudieron subir las imágenes."));
    }
    return Array.isArray(data?.images) ? (data.images as ProductImage[]) : [];
  }

  async function removeImage(imageId: string) {
    if (!product.id) return false;
    const res = await fetch(`/api/admin/products/${product.id}/images/${imageId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo borrar la imagen."));
      return false;
    }
    setImages((prev) => prev.filter((image) => image.id !== imageId));
    return true;
  }

  async function confirmRemoveImage() {
    if (!imageDeleteTarget) return;
    setDeletingImage(true);
    const removed = await removeImage(imageDeleteTarget.id);
    setDeletingImage(false);
    if (removed) setImageDeleteTarget(null);
  }

  async function deleteProduct() {
    if (!product.id || mode !== "edit") return;

    setDeleting(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(String(data?.error || "No se pudo eliminar el producto."));
        setDeleting(false);
        return;
      }

      if (data?.mode === "deactivated") {
        setIsActive(false);
        setStock(0);
        setVariantRows((prev) => prev.map((variant) => ({ ...variant, stock: 0 })));
        setDeleteOpen(false);
        setMsg(String(data?.message || "El producto tiene pedidos asociados. Se desactivó para conservar el historial."));
        setDeleting(false);
        return;
      }

      window.location.href = backHref;
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "No se pudo eliminar el producto.");
      setDeleting(false);
    }
  }

  async function submit() {
    setMsg(null);

    if (!name.trim()) {
      setMsg("Ingresá el nombre del producto.");
      return;
    }
    if (!slugify(slug || name)) {
      setMsg("Ingresá un slug válido.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setMsg("Ingresá un precio válido.");
      return;
    }
    if (!hasVariants && (!Number.isFinite(stock) || stock < 0)) {
      setMsg("Ingresá un stock válido.");
      return;
    }
    if (hasVariants && !variantValidation.ok) {
      setMsg(variantValidation.errors[0] || "Configuración de variantes inválida.");
      return;
    }
    if (hasVariants && visibleVariantRows.length === 0) {
      setMsg("Dejá al menos una combinación activa.");
      return;
    }

    const payload = {
      name: name.trim(),
      sku: sku.trim(),
      slug: slugify(slug || name),
      description,
      price,
      stock: hasVariants ? totalVariantStock : stock,
      isActive,
      categoryId,
      hasVariants,
      options: hasVariants
        ? options.map((option) => ({
            id: option.id,
            clientKey: option.clientKey,
            name: option.name,
            values: option.values.map((value) => ({
              id: value.id,
              clientKey: value.clientKey,
              value: value.value,
            })),
          }))
        : [],
      variantCombinations: hasVariants
        ? variantRows.map((variant) => ({
            id: variant.id,
            stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
            sku: null,
            priceOverride: variant.priceOverride ? Number(variant.priceOverride.replace(",", ".")) : null,
            optionValueKeys: variant.optionValueKeys,
            enabled: variant.enabled,
          }))
        : [],
    };

    setLoading(true);
    try {
      const res = await fetch(mode === "create" ? "/api/admin/products" : `/api/admin/products/${product.id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setMsg(await readResponseError(res, "No se pudo guardar el producto."));
        setLoading(false);
        return;
      }
      const data = await res.json().catch(() => ({}));

      const productId = String(data?.product?.id || product.id || "");
      const uploadedPendingImages = pendingImages;
      let uploadedImages: ProductImage[] = [];

      if (productId && uploadedPendingImages.length > 0) {
        const newUploadedImages = await uploadProductImages(productId);
        uploadedImages = newUploadedImages.filter((image) => image.id);
        if (uploadedImages.length > 0) {
          setImages((prev) => {
            const merged = [...prev];
            for (const image of uploadedImages) {
              if (!image.id) continue;
              if (merged.some((existing) => existing.id === image.id)) continue;
              merged.push(image);
            }
            return merged;
          });
        }
      }

      if (productId && hasVariants) {
        const savedVariants = Array.isArray(data?.variants) ? (data.variants as SavedVariantSummary[]) : [];
        const savedVariantIdsByCombinationKey = buildSavedVariantIdMap(savedVariants);
        const imageKeyToId = new Map<string, string>();
        for (const image of images) imageKeyToId.set(image.id, image.id);
        uploadedPendingImages.forEach((image, index) => {
          const uploaded = uploadedImages[index];
          if (uploaded?.id) imageKeyToId.set(image.key, uploaded.id);
        });

        await saveVariantImageAssignments(
          productId,
          variantRows
            .map((variant) => ({
              variantId: savedVariantIdsByCombinationKey.get(variant.combinationKey) ?? "",
              imageIds: (variantImageAssignments[variant.combinationKey] ?? [])
                .map((imageKey) => imageKeyToId.get(imageKey))
                .filter(Boolean) as string[],
            }))
            .filter((assignment) => assignment.variantId)
        );
      }

      if (mode === "create" && productId) {
        for (const image of uploadedPendingImages) URL.revokeObjectURL(image.url);
        window.location.href = `/admin/products/${productId}`;
        return;
      }

      for (const image of uploadedPendingImages) URL.revokeObjectURL(image.url);
      setPendingImages([]);
      if (Array.isArray(data?.product?.images)) {
        setImages(data.product.images as ProductImage[]);
      }
      setMsg("Producto guardado.");
    } catch (error) {
      setMsg(error instanceof Error ? `No se pudo guardar el producto. ${error.message}` : "No se pudo guardar el producto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-4">
          <Link href={backHref} className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Volver
          </Link>

          {mode === "edit" ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="rounded-xl border border-red-600 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              Borrar producto
            </button>
          ) : null}
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h1 className="text-xl font-semibold">{mode === "create" ? "Nuevo producto" : "Editar producto"}</h1>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-zinc-300">Nombre</label>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (mode === "create") setSlug(slugify(event.target.value));
                  }}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-300">Slug</label>
                <input
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm text-zinc-300">SKU</label>
                <input
                  value={sku}
                  onChange={(event) => setSku(event.target.value)}
                  placeholder="Opcional"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-300">Descripción</label>
              <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-950">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
                  <button type="button" onClick={() => formatDescription("bold")} className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm font-bold hover:bg-zinc-900/60">B</button>
                  <button type="button" onClick={() => formatDescription("italic")} className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm italic hover:bg-zinc-900/60">I</button>
                  <button type="button" onClick={() => formatDescription("underline")} className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm underline hover:bg-zinc-900/60">U</button>
                  <label className="flex h-8 cursor-pointer items-center rounded-lg border border-zinc-800 px-2 text-sm hover:bg-zinc-900/60">
                    Imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void uploadDescriptionImage(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <div
                  ref={descriptionRef}
                  contentEditable
                  dir="ltr"
                  suppressContentEditableWarning
                  onInput={syncDescriptionFromEditor}
                  className="min-h-28 w-full px-3 py-2 text-left text-sm leading-6 outline-none [unicode-bidi:plaintext] [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="text-sm text-zinc-300">Precio general</label>
                <input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(Number(event.target.value))}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm text-zinc-300">Categoría</label>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label ?? category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-zinc-300">{hasVariants ? "Stock total" : "Stock"}</label>
                <input
                  type="number"
                  value={hasVariants ? totalVariantStock : stock}
                  onChange={(event) => setStock(Number(event.target.value))}
                  disabled={hasVariants}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 disabled:opacity-60"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />
              Publicado (visible en tienda)
            </label>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Variantes</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Agregá opciones como talle, color, material o cualquier característica que cambie entre versiones del producto.
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input type="checkbox" checked={hasVariants} onChange={(event) => setHasVariants(event.target.checked)} />
                  Este producto tiene variantes
                </label>
              </div>

              {hasVariants ? (
                <>
                  <div className="mt-5">
                    <div className="mb-3 text-sm font-semibold text-zinc-200">Opciones</div>
                    <div className="grid gap-3">
                      {options.map((option, optionIndex) => (
                        <div key={option.clientKey} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <input
                              value={option.name}
                              onChange={(event) =>
                                setOptions((prev) =>
                                  prev.map((item) => (item.clientKey === option.clientKey ? { ...item, name: event.target.value } : item))
                                )
                              }
                              placeholder={`Opción ${optionIndex + 1} (ej: Talle)`}
                              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setOptions((prev) => prev.filter((item) => item.clientKey !== option.clientKey))}
                              className="rounded-xl bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
                            >
                              Eliminar
                            </button>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {option.values.map((value) => (
                              <div key={value.clientKey} className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-2">
                                <input
                                  value={value.value}
                                  onChange={(event) =>
                                    setOptions((prev) =>
                                      prev.map((item) =>
                                        item.clientKey === option.clientKey
                                          ? {
                                              ...item,
                                              values: item.values.map((candidate) =>
                                                candidate.clientKey === value.clientKey ? { ...candidate, value: event.target.value } : candidate
                                              ),
                                            }
                                          : item
                                      )
                                    )
                                  }
                                  placeholder="Valor"
                                  className="min-w-20 bg-transparent text-sm outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOptions((prev) =>
                                      prev.map((item) =>
                                        item.clientKey === option.clientKey
                                          ? { ...item, values: item.values.filter((candidate) => candidate.clientKey !== value.clientKey) }
                                          : item
                                      )
                                    )
                                  }
                                  className="text-xs text-zinc-500 hover:text-zinc-100"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => addOptionValue(option.clientKey)}
                            className="mt-4 rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900/60"
                          >
                            + Agregar valor
                          </button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addOption} className="mt-4 rounded-xl border border-zinc-800 px-3 py-2 text-sm hover:bg-zinc-900/60">
                      + Agregar opción
                    </button>
                  </div>

                  <div className="mt-6">
                    <div className="mb-3 text-sm font-semibold text-zinc-200">Combinaciones</div>
                    {!variantValidation.ok ? (
                      <div className="rounded-xl border border-amber-300 bg-amber-100 p-3 text-sm text-amber-900">
                        {variantValidation.errors[0]}
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-zinc-800">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-left text-sm">
                            <thead className="bg-zinc-900 text-zinc-400">
                              <tr>
                                <th className="px-3 py-2">Variante</th>
                                <th className="px-3 py-2">Stock</th>
                                <th className="px-3 py-2">SKU principal</th>
                                <th className="px-3 py-2">Precio</th>
                                <th className="px-3 py-2 text-right">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
                              {visibleVariantRows.map((variant) => (
                                <tr key={variant.combinationKey}>
                                  <td className="px-3 py-2 text-zinc-200">{variant.label}</td>
                                  <td className="px-3 py-2">
                                    <input
                                      type="number"
                                      min={0}
                                      value={variant.stock}
                                      onChange={(event) =>
                                        setVariantRows((prev) =>
                                          prev.map((item) =>
                                            item.combinationKey === variant.combinationKey
                                              ? { ...item, stock: Math.max(0, Math.floor(Number(event.target.value) || 0)) }
                                              : item
                                          )
                                        )
                                      }
                                      className="w-24 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      value={sku}
                                      readOnly
                                      placeholder="Usa el SKU principal"
                                      className="w-36 rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-zinc-400"
                                    />
                                  </td>
                                  <td className="px-3 py-2">
                                    <input
                                      value={variant.priceOverride}
                                      onChange={(event) =>
                                        setVariantRows((prev) =>
                                          prev.map((item) =>
                                            item.combinationKey === variant.combinationKey
                                              ? { ...item, priceOverride: event.target.value.replace(/[^\d.,]/g, "") }
                                              : item
                                          )
                                        )
                                      }
                                      placeholder="Usa precio general"
                                      className="w-40 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2"
                                    />
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setVariantRows((prev) =>
                                          prev.map((item) =>
                                            item.combinationKey === variant.combinationKey ? { ...item, enabled: false } : item
                                          )
                                        )
                                      }
                                      className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                                    >
                                      Desactivar
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {hiddenVariantRows.length > 0 ? (
                      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                        <div className="text-sm font-semibold text-zinc-200">Combinaciones desactivadas</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {hiddenVariantRows.map((variant) => (
                            <button
                              key={variant.combinationKey}
                              type="button"
                              onClick={() =>
                                setVariantRows((prev) =>
                                  prev.map((item) =>
                                    item.combinationKey === variant.combinationKey ? { ...item, enabled: true } : item
                                  )
                                )
                              }
                              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
                            >
                              Activar {variant.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>

            <div className="rounded-2xl border border-[#e5d8ca] bg-[#fffdfb] p-4 text-[#70471f] shadow-sm sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">Imágenes del producto</div>
                  <div className="mt-1 text-xs text-[#927b68]">Subí las fotos una sola vez. Luego podrás elegir qué fotos se muestran en cada variante.</div>
                </div>
                <div className="group relative">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#e5d8ca] bg-[#f8f3ed] px-2.5 py-1.5 text-[11px] font-medium text-[#70471f] outline-none transition hover:border-[#b98b5e] focus:border-[#8b5728] focus:ring-2 focus:ring-[#8b5728]/15"
                    aria-label="Cómo funcionan las imágenes del producto"
                  >
                    <Info className="h-3.5 w-3.5" /> Cómo funciona
                  </button>
                  <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 origin-top-right rounded-xl border border-[#e5d8ca] bg-white p-3 text-left text-xs leading-5 text-[#70471f] opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                    <div className="font-semibold">¿Cómo se usa?</div>
                    <p className="mt-1 text-[#927b68]">Agregá las imágenes una sola vez desde la tarjeta “Agregar imágenes”.</p>
                    <p className="mt-1 text-[#927b68]">Arrastrá las tarjetas para cambiar el orden. La primera imagen será la principal del producto.</p>
                    <p className="mt-1 text-[#927b68]">Desde “Fotos por variante” podés elegir qué imágenes se muestran en cada combinación.</p>
                  </div>
                </div>
              </div>
              {pendingImages.length > 0 ? <div className="mt-3 text-sm text-zinc-400">{pendingImages.length} imagen(es) lista(s) para subir al guardar.</div> : null}
              {pendingImages.length > 0 ? (
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {pendingImages.map((preview, index) => (
                    <div
                      key={preview.url}
                      draggable
                      onDragStart={(event) => handlePendingImageDragStart(event, index)}
                      onDragOver={(event) => handlePendingImageDragOver(event, index)}
                      onDrop={(event) => handlePendingImageDrop(event, index)}
                      onDragEnd={resetPendingImageDragState}
                      className={`overflow-hidden rounded-xl border border-dashed bg-zinc-900/60 transition ${pendingImageDropIndex === index ? "border-[var(--admin-primary)] ring-2 ring-[var(--admin-primary)]/20" : "border-zinc-700"} ${draggedPendingImageIndex === index ? "opacity-70" : ""}`}
                    >
                      <div className="relative aspect-square bg-zinc-950/40">
                        <img src={preview.url} alt={preview.name} className="h-full w-full object-cover" />
                        <div className="absolute left-2 top-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => movePendingImage(index, index - 1)}
                            disabled={index === 0}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/80 text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Mover imagen a la izquierda"
                          >
                            <ArrowLeft className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePendingImage(index, index + 1)}
                            disabled={index === pendingImages.length - 1}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/80 text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Mover imagen a la derecha"
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePendingImage(index)}
                          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-950/80 text-zinc-100 hover:bg-zinc-900"
                          aria-label="Quitar imagen"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2 left-2 rounded-md bg-zinc-950/80 px-2 py-1 text-[11px] font-medium text-zinc-100">
                          {index + 1}
                        </div>
                      </div>
                      <div className="truncate border-t border-zinc-800 px-3 py-2 text-xs text-zinc-400" title={preview.name}>
                        {preview.name}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {images.map((image, index) => (
                    (() => {
                      const usedByCount = Object.values(variantImageAssignments).filter((imageIds) => imageIds.includes(image.id)).length;
                      return (
                    <div
                      key={image.id}
                      draggable={mode === "edit"}
                      onDragStart={(event) => handleSavedImageDragStart(event, index)}
                      onDragOver={(event) => handleSavedImageDragOver(event, index)}
                      onDrop={(event) => void handleSavedImageDrop(event, index)}
                      onDragEnd={resetSavedImageDragState}
                      className={`overflow-hidden rounded-xl border border-[#e5d8ca] bg-white transition ${savedImageDropIndex === index ? "border-[#8b5728] ring-2 ring-[#8b5728]/20" : ""} ${draggedSavedImageIndex === index ? "opacity-70" : ""}`}
                    >
                      <div className="relative aspect-[1.15]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={image.url} alt="" className="h-full w-full object-cover" />
                        {mode === "edit" ? (
                          <>
                            <div className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 text-[#70471f] shadow">
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#8b5728] text-sm font-semibold text-white shadow">
                              {index + 1}
                            </div>
                            {index === 0 ? <span className="absolute bottom-2 left-2 rounded-md bg-[#8b5728] px-2 py-1 text-[11px] font-semibold text-white">★ Principal</span> : null}
                          </>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t border-[#eee5dc] px-3 py-2.5 text-xs">
                        <span className="truncate text-[#70471f]">{usedByCount > 0 ? `Usada en ${usedByCount} variante${usedByCount === 1 ? "" : "s"}` : "Sin asignar"}</span>
                        {mode === "edit" ? <button type="button" onClick={() => setImageDeleteTarget(image)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#e5d8ca] text-[#70471f] hover:border-[#b98b5e]" aria-label="Quitar imagen"><Trash2 className="h-4 w-4" /></button> : null}
                      </div>
                    </div>
                      );
                    })()
                  ))}
                  <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#d8b995] bg-[#fffaf5] px-3 text-center hover:bg-[#fff6eb]">
                    <Plus className="h-8 w-8 text-[#8b5728]" />
                    <span className="mt-2 text-sm font-semibold">Agregar imágenes</span>
                    <span className="mt-1 text-xs text-[#927b68]">JPG, PNG o WebP</span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      setPendingImages((prev) => {
                        for (const pending of prev) URL.revokeObjectURL(pending.url);
                        return files.map(createPendingImage);
                      });
                    }} />
                  </label>
              </div>
              {hasVariants && visibleVariantRows.length > 0 && assignableImages.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-[#e5d8ca] bg-[#fffdfb] p-4 text-[#70471f] shadow-sm sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">Fotos por variante</div>
                      <div className="mt-1 text-xs text-[#927b68]">
                        Seleccioná las imágenes que se muestran en esta variante y arrastralas para definir el orden.
                      </div>
                    </div>
                    <div className="group relative hidden sm:block">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-[#e5d8ca] bg-[#f8f3ed] px-2.5 py-1.5 text-[11px] font-medium text-[#70471f] outline-none transition hover:border-[#b98b5e] focus:border-[#8b5728] focus:ring-2 focus:ring-[#8b5728]/15"
                        aria-label="Cómo funcionan las fotos por variante"
                      >
                        <Info className="h-3.5 w-3.5" /> Cómo funciona
                      </button>
                      <div className="pointer-events-none absolute right-0 top-full z-20 mt-2 w-72 origin-top-right rounded-xl border border-[#e5d8ca] bg-white p-3 text-left text-xs leading-5 text-[#70471f] opacity-0 shadow-lg transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                        <div className="font-semibold">¿Cómo se usa?</div>
                        <p className="mt-1 text-[#927b68]">Elegí una variante en el selector y usá el botón <span className="font-semibold text-[#70471f]">+</span> para asignarle imágenes.</p>
                        <p className="mt-1 text-[#927b68]">Arrastrá las fotos seleccionadas para cambiar el orden. La primera será la principal.</p>
                        <p className="mt-1 text-[#927b68]">Una misma imagen puede asignarse a varias variantes.</p>
                      </div>
                    </div>
                  </div>

                  <label className="mt-4 block">
                    <span className="sr-only">Seleccionar variante</span>
                    <div className="relative">
                      <select
                        value={selectedVariantImageKey ?? ""}
                        onChange={(event) => setSelectedVariantImageKey(event.target.value)}
                        className="w-full cursor-pointer appearance-none rounded-xl border border-[#d8c4b0] bg-white px-3 py-3 pr-10 text-sm text-[#70471f] outline-none transition hover:border-[#b98b5e] focus:border-[#8b5728] focus:ring-2 focus:ring-[#8b5728]/15"
                      >
                        {visibleVariantRows.map((variant) => {
                          const assignedCount = variantImageAssignments[variant.combinationKey]?.length ?? 0;
                          return (
                            <option key={variant.combinationKey} value={variant.combinationKey}>
                              {variant.label} · {assignedCount} foto{assignedCount === 1 ? "" : "s"}
                            </option>
                          );
                        })}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8b5728]" aria-hidden="true" />
                    </div>
                  </label>

                  {selectedVariantForImages ? (
                    <>
                      <div className="mt-5 rounded-xl border border-[#eadfd4] bg-white p-3 sm:p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">Fotos para {selectedVariantForImages.label}</div>
                            <div className="mt-1 text-xs text-[#927b68]">Seleccioná las imágenes y arrastralas para definir el orden. La primera será la foto principal.</div>
                          </div>
                          <span className="shrink-0 rounded-lg bg-[#f8f3ed] px-2.5 py-1.5 text-[11px] font-semibold text-[#70471f]">
                            {selectedVariantAssignedImages.length} de {assignableImages.length} seleccionadas
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                          {selectedVariantAssignedImages.map((image, index) => (
                            <div
                              key={`${selectedVariantForImages.combinationKey}:${image.key}`}
                              draggable
                              onDragStart={(event) => handleVariantAssignedImageDragStart(event, index)}
                              onDragOver={(event) => handleVariantAssignedImageDragOver(event, index)}
                              onDrop={(event) => handleVariantAssignedImageDrop(event, selectedVariantForImages.combinationKey, index)}
                              onDragEnd={resetVariantAssignedImageDragState}
                              className={`overflow-hidden rounded-xl border-2 bg-white transition ${variantImageDropIndex === index ? "border-[#8b5728] ring-2 ring-[#8b5728]/20" : "border-[#8b5728]"} ${draggedVariantImageIndex === index ? "opacity-70" : ""}`}
                            >
                              <div className="relative aspect-[1.08]">
                                <img src={image.url} alt={image.name} className="h-full w-full object-cover" />
                                <div className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#8b5728] text-xs font-semibold text-white shadow">
                                  {index + 1}
                                </div>
                                {index === 0 ? <span className="absolute bottom-1.5 left-1.5 rounded-md bg-[#8b5728] px-1.5 py-1 text-[10px] font-semibold text-white">★ Principal</span> : null}
                                <button type="button" onClick={() => toggleVariantImageAssignment(selectedVariantForImages.combinationKey, image.key)} className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#70471f] shadow hover:bg-white" aria-label={`Quitar ${image.name}`}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {assignableImages.filter((image) => !(variantImageAssignments[selectedVariantForImages.combinationKey] ?? []).includes(image.key)).map((image) => {
                          return (
                            <div
                              key={`${selectedVariantForImages.combinationKey}:${image.key}:picker`}
                              className="overflow-hidden rounded-xl border border-[#e8e1da] bg-[#f4f4f4]"
                            >
                              <div className="relative aspect-[1.08]">
                                <img src={image.url} alt={image.name} className="h-full w-full object-cover" />
                                <button type="button" onClick={() => toggleVariantImageAssignment(selectedVariantForImages.combinationKey, image.key)} className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#29231e] shadow hover:bg-white" aria-label={`Usar ${image.name}`}><Plus className="h-4 w-4" /></button>
                              </div>
                            </div>
                          );
                        })}
                        </div>
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#f8f3ed] px-3 py-2.5 text-xs text-[#70471f]"><GripVertical className="h-4 w-4 shrink-0" /> Arrastrá las fotos seleccionadas para cambiar el orden</div>
                        <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#f1f3fb] px-3 py-2.5 text-xs text-[#5b5f70]"><Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span>Una misma imagen puede usarse en varias variantes.<br /><span className="text-[10px] text-[#777b89]">Si una imagen ya está asignada a otra variante, te lo indicaremos al pasar el mouse.</span></span></div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>

            {msg ? <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">{msg}</div> : null}

            <button
              type="button"
              disabled={loading}
              onClick={() => void submit()}
              className="mt-2 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Guardando..." : mode === "create" ? "Crear producto" : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(imageDeleteTarget)}
        title="Quitar imagen"
        description="La imagen se quitará del producto y de todas las variantes donde esté asignada. Esta acción no se puede deshacer."
        confirmLabel={deletingImage ? "Quitando..." : "Quitar imagen"}
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingImage}
        onConfirm={() => void confirmRemoveImage()}
        onCancel={() => {
          if (!deletingImage) setImageDeleteTarget(null);
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar producto"
        description="Se eliminará este producto. Si tiene pedidos asociados, no se borrará físicamente: se desactivará para conservar el historial."
        confirmLabel={deleting ? "Eliminando..." : "Eliminar producto"}
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
        onConfirm={() => void deleteProduct()}
        onCancel={() => {
          if (!deleting) setDeleteOpen(false);
        }}
      />
    </main>
  );
}
