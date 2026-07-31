"use client";

import Link from "next/link";
import { useState } from "react";
import { GripVertical, ImageIcon, PackagePlus } from "lucide-react";
import EmptyState from "@/components/admin/data/EmptyState";
import StatusBadge from "@/components/admin/data/StatusBadge";
import DuplicateProductButton from "./DuplicateProductButton";

type ProductGroup = {
  id: string;
  sortOrder?: number;
  name: string;
  description: string | null;
  slug: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: string | Date;
  categories: Array<{ name: string; slug: string }>;
  images: Array<{ url: string }>;
  products: Array<{ id: string }>;
};

type DropHint = {
  targetId: string;
  position: "before" | "after";
};

function reorderProducts(products: ProductGroup[], draggedId: string, targetId: string, position: "before" | "after") {
  const draggedIndex = products.findIndex((item) => item.id === draggedId);
  const targetIndex = products.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return products;

  const next = [...products];
  const [dragged] = next.splice(draggedIndex, 1);
  const baseIndex = next.findIndex((item) => item.id === targetId);
  next.splice(baseIndex + (position === "after" ? 1 : 0), 0, dragged);
  return next.map((item, index) => ({ ...item, sortOrder: index }));
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function stockStatus(stock: number) {
  if (stock <= 0) return { label: "Sin stock", variant: "danger" as const };
  if (stock <= 2) return { label: `Crítico · ${stock}`, variant: "warning" as const };
  if (stock < 5) return { label: `Bajo · ${stock}`, variant: "warning" as const };
  return { label: `${stock} unidades`, variant: "success" as const };
}

function dispatchBulkSelectionChange() {
  document.dispatchEvent(new Event("bulk-products-change"));
}

export default function AdminProductsTable({
  initialProducts,
  baseParams,
  returnHref,
  manualOrder,
}: {
  initialProducts: ProductGroup[];
  baseParams: Record<string, string>;
  returnHref: string;
  manualOrder: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  function selectVisible(checked: boolean) {
    document.querySelectorAll<HTMLInputElement>('input[name="bulkProductIds"]').forEach((input) => {
      input.checked = checked;
    });
    dispatchBulkSelectionChange();
  }

  async function toggleActive(product: ProductGroup) {
    const nextIsActive = !product.isActive;
    const previousProducts = products;

    setProducts((current) =>
      current.map((item) => (item.id === product.id ? { ...item, isActive: nextIsActive } : item))
    );

    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isActive: nextIsActive,
        variantIds: product.products.map((item) => item.id),
      }),
    });

    if (!res.ok) {
      setProducts(previousProducts);
    }
  }

  async function persistOrder(nextProducts: ProductGroup[]) {
    const orderedGroups = nextProducts.map((item) => ({
      id: item.id,
      productIds: item.products.map((product) => product.id),
    }));

    const res = await fetch("/api/admin/products/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedGroups }),
    });

    if (!res.ok) {
      location.reload();
    }
  }

  return (
    <div className="mt-6 xl:mt-4 overflow-hidden rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed">
          <caption className="sr-only">Productos del catálogo</caption>
          <thead className="bg-[#F6F0EA]">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">
              <th className="w-14 px-4 py-4 xl:py-2.5">
                <input
                  type="checkbox"
                  aria-label="Seleccionar productos visibles"
                  onChange={(event) => selectVisible(event.currentTarget.checked)}
                  className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]/30"
                />
              </th>
              <th className="px-4 py-4 xl:py-2.5">Producto</th>
              <th className="w-44 px-4 py-4 xl:py-2.5">Categoría</th>
              <th className="w-32 px-4 py-4 xl:py-2.5">Precio</th>
              <th className="w-36 px-4 py-4 xl:py-2.5">Stock</th>
              <th className="w-28 px-4 py-4 xl:py-2.5">Estado</th>
              <th className="sticky right-0 w-40 bg-[#F6F0EA] px-4 py-4 xl:py-2.5 text-right">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--admin-border)] bg-white/45">
            {products.map((p) => {
              const img = p.images?.[0]?.url;
              const variantsCount = p.products.length;
              const showTopHint = dropHint?.targetId === p.id && dropHint.position === "before";
              const showBottomHint = dropHint?.targetId === p.id && dropHint.position === "after";
              const inventory = stockStatus(p.stock);

              return (
                <tr
                  key={p.id}
                  className={`relative text-sm transition duration-150 hover:bg-[var(--admin-surface-muted)] ${draggedId === p.id ? "opacity-60" : ""}`}
                  onDragOver={(event) => {
                    if (!manualOrder) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                    setDropHint({ targetId: p.id, position });
                  }}
                  onDrop={async (event) => {
                    if (!manualOrder || !draggedId) return;
                    event.preventDefault();
                    const rect = event.currentTarget.getBoundingClientRect();
                    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
                    const nextProducts = reorderProducts(products, draggedId, p.id, position);
                    setProducts(nextProducts);
                    setDraggedId(null);
                    setDropHint(null);
                    await persistOrder(nextProducts);
                  }}
                >
                  {showTopHint && <td colSpan={7} className="absolute inset-x-0 top-0 h-1 bg-[var(--admin-primary)] p-0" />}
                  {showBottomHint && <td colSpan={7} className="absolute inset-x-0 bottom-0 h-1 bg-[var(--admin-primary)] p-0" />}
                  <td className="px-4 py-4 xl:py-2.5">
                    <div className="flex items-center gap-2">
                      {manualOrder && (
                        <button
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            setDraggedId(p.id);
                          }}
                          onDragEnd={() => {
                            setDraggedId(null);
                            setDropHint(null);
                          }}
                          className="cursor-grab rounded-lg border border-[var(--admin-border)] bg-[var(--admin-background)] p-1 text-[var(--admin-muted)] active:cursor-grabbing"
                          title="Arrastrar para reordenar"
                          aria-label={`Reordenar ${p.name}`}
                        >
                          <GripVertical className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                      <input
                        type="checkbox"
                        name="bulkProductIds"
                        value={p.products.map((item) => item.id).join(",")}
                        onChange={dispatchBulkSelectionChange}
                        aria-label={`Seleccionar ${p.name}`}
                        className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]/30"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 xl:py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)]">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-[var(--admin-muted-2)]" aria-hidden="true" />
                        )}
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <div className="truncate font-semibold text-[var(--admin-text)]">{p.name}</div>
                        <div className="mt-1 truncate text-xs text-[var(--admin-muted)]" title={`/products/${p.slug}`}>
                          {variantsCount} variante{variantsCount === 1 ? "" : "s"}
                          {variantsCount > 1 ? " agrupadas" : ""}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4 xl:py-2.5">
                    {p.categories.length === 0 ? (
                      <span className="text-xs text-[var(--admin-muted)]">Sin categoría</span>
                    ) : (
                      <div className="flex max-w-full flex-wrap gap-1.5">
                        {p.categories.map((item) => (
                          <Link
                            key={item.slug}
                            href={`/admin/products?${new URLSearchParams({ ...baseParams, category: item.slug, page: "1" }).toString()}`}
                            className="rounded-full border border-[var(--admin-border)] px-2.5 py-1 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-4 xl:py-2.5 font-semibold text-[var(--admin-text)]">{money(p.price)}</td>

                  <td className="px-4 py-4 xl:py-2.5">
                    <StatusBadge label={inventory.label} variant={inventory.variant} />
                  </td>

                  <td className="px-4 py-4 xl:py-2.5">
                    <button
                      type="button"
                      onClick={() => void toggleActive(p)}
                      title={p.isActive ? "Click para marcar como inactivo" : "Click para marcar como activo"}
                      aria-label={p.isActive ? `Marcar ${p.name} como inactivo` : `Marcar ${p.name} como activo`}
                      className="transition duration-150 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                    >
                      <StatusBadge label={p.isActive ? "Activo" : "Inactivo"} variant={p.isActive ? "success" : "neutral"} />
                    </button>
                  </td>

                  <td className="sticky right-0 bg-white/95 px-4 py-4 xl:py-2.5">
                    <div className="flex justify-end gap-2">
                      <Link href={`/admin/products/${p.id}?${new URLSearchParams({ returnTo: returnHref }).toString()}`} className="rounded-xl border border-[var(--admin-border)] px-3 py-1.5 text-center text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]">
                        Editar
                      </Link>
                      <DuplicateProductButton productId={p.id} returnHref={returnHref} />
                    </div>
                  </td>
                </tr>
              );
            })}

            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 xl:py-8">
                  <EmptyState
                    icon={PackagePlus}
                    title="No encontramos productos con esos filtros."
                    description="Probá ajustar la búsqueda, cambiar el estado o limpiar los filtros."
                    action={
                      <Link
                        href="/admin/products"
                        className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)]"
                      >
                        Limpiar filtros
                      </Link>
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
