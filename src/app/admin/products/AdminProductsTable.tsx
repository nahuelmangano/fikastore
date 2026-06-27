"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function AdminProductsTable({
  initialProducts,
  baseParams,
  manualOrder,
}: {
  initialProducts: ProductGroup[];
  baseParams: Record<string, string>;
  manualOrder: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

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
    <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-zinc-900/40">
            <tr className="text-left text-xs text-zinc-400">
              <th className="w-14 px-3 py-3">Sel.</th>
              <th className="px-3 py-3">Producto</th>
              <th className="w-32 px-3 py-3">Categoria</th>
              <th className="w-20 px-3 py-3">Precio</th>
              <th className="w-20 px-3 py-3">Stock</th>
              <th className="w-20 px-3 py-3">Estado</th>
              <th className="sticky right-0 w-36 bg-zinc-900/40 px-3 py-3">Accion</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-800 bg-zinc-950/20">
            {products.map((p) => {
              const img = p.images?.[0]?.url;
              const isOos = p.stock <= 0;
              const variantsCount = p.products.length;
              const showTopHint = dropHint?.targetId === p.id && dropHint.position === "before";
              const showBottomHint = dropHint?.targetId === p.id && dropHint.position === "after";

              return (
                <tr
                  key={p.id}
                  className={`relative text-sm ${draggedId === p.id ? "opacity-60" : ""}`}
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
                  {showTopHint && <td colSpan={7} className="absolute inset-x-0 top-0 h-1 bg-amber-500 p-0" />}
                  {showBottomHint && <td colSpan={7} className="absolute inset-x-0 bottom-0 h-1 bg-amber-500 p-0" />}
                  <td className="px-3 py-3">
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
                          className="cursor-grab rounded-md border border-zinc-800 bg-zinc-900 px-1.5 py-1 text-zinc-500 active:cursor-grabbing"
                          title="Arrastrar para reordenar"
                        >
                          ⋮⋮
                        </button>
                      )}
                      <input
                        type="checkbox"
                        name="bulkProductIds"
                        value={p.products.map((item) => item.id).join(",")}
                        aria-label={`Seleccionar ${p.name}`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img ?? "https://placehold.co/80x80/png?text=Fika"}
                          alt={p.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 overflow-hidden">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="mt-0.5 truncate text-xs text-zinc-500">
                          {variantsCount} variante{variantsCount === 1 ? "" : "s"} · /products/{p.slug}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    {p.categories.length === 0 ? (
                      <span className="text-xs text-zinc-500">Sin categoria</span>
                    ) : (
                      <div className="flex max-w-full flex-wrap gap-1.5">
                        {p.categories.map((item) => (
                          <Link
                            key={item.slug}
                            href={`/admin/products?${new URLSearchParams({ ...baseParams, category: item.slug, page: "1" }).toString()}`}
                            className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs hover:bg-zinc-900/60"
                          >
                            {item.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3">${p.price.toLocaleString("es-AR")}</td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={[
                          "inline-flex min-w-8 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                          isOos ? "border-rose-700/40 bg-rose-100 text-rose-800" : "border-emerald-700/40 bg-emerald-100 text-emerald-800",
                        ].join(" ")}
                      >
                        {p.stock}
                      </span>
                      {isOos && <span className="text-xs font-medium text-rose-700">Sin stock</span>}
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <button
                      type="button"
                      onClick={() => void toggleActive(p)}
                      title={p.isActive ? "Click para marcar como inactivo" : "Click para marcar como activo"}
                      aria-label={p.isActive ? `Marcar ${p.name} como inactivo` : `Marcar ${p.name} como activo`}
                      className={[
                        "inline-flex cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-95",
                        p.isActive ? "border-emerald-700/50 bg-emerald-100 text-emerald-900" : "border-slate-600/60 bg-slate-200 text-slate-900",
                      ].join(" ")}
                    >
                      {p.isActive ? "Activo" : "Inactivo"}
                    </button>
                  </td>

                  <td className="sticky right-0 bg-zinc-950 px-3 py-3">
                    <div className="flex flex-col gap-2">
                      <Link href={`/admin/products/${p.id}`} className="rounded-xl border border-zinc-800 px-3 py-1.5 text-center text-xs hover:bg-zinc-900/60">
                        Editar
                      </Link>
                      <DuplicateProductButton productId={p.id} />
                    </div>
                  </td>
                </tr>
              );
            })}

            {products.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">
                  No hay productos con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
