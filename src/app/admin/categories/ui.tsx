"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { flattenCategories } from "@/lib/categories";
import { slugify } from "@/lib/slug";

type Category = {
  id: string;
  parentId?: string | null;
  sortOrder?: number;
  name: string;
  slug: string;
  label?: string;
  depth?: number;
  description: string | null;
  _count: { products: number };
};

type DragState = {
  id: string;
  parentId: string | null;
};

type DropHint = {
  targetId: string;
  position: "before" | "after";
};

const levelStyles = [
  {
    border: "border-amber-300",
    chip: "bg-amber-100 text-amber-900 ring-amber-200",
    accent: "bg-amber-500",
  },
  {
    border: "border-stone-300",
    chip: "bg-stone-100 text-stone-700 ring-stone-200",
    accent: "bg-stone-400",
  },
  {
    border: "border-stone-300",
    chip: "bg-stone-100 text-stone-700 ring-stone-200",
    accent: "bg-stone-400",
  },
  {
    border: "border-stone-300",
    chip: "bg-stone-100 text-stone-700 ring-stone-200",
    accent: "bg-stone-400",
  },
] as const;

function normalizeCategories(categories: Category[]) {
  return flattenCategories(categories).map((category) => ({
    ...category,
    sortOrder: category.sortOrder ?? 0,
  }));
}

function getLevelStyle(depth = 0) {
  return levelStyles[Math.min(depth, levelStyles.length - 1)];
}

function getDepthLabel(depth = 0) {
  if (depth === 0) return "Principal";
  if (depth === 1) return "Subcategoria";
  return `Nivel ${depth + 1}`;
}

function groupByParent(categories: Category[]) {
  const byParent = new Map<string, Category[]>();

  for (const category of categories) {
    const parentKey = category.parentId ?? "";
    byParent.set(parentKey, [...(byParent.get(parentKey) ?? []), category]);
  }

  for (const items of byParent.values()) {
    items.sort((a, b) => {
      const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return a.name.localeCompare(b.name);
    });
  }

  return byParent;
}

function reorderSiblings(
  categories: Category[],
  draggedId: string,
  targetId: string,
  position: "before" | "after"
) {
  const dragged = categories.find((item) => item.id === draggedId);
  const target = categories.find((item) => item.id === targetId);
  if (!dragged || !target) return categories;
  if ((dragged.parentId ?? null) !== (target.parentId ?? null)) return categories;

  const parentId = dragged.parentId ?? null;
  const siblingItems = categories
    .filter((item) => (item.parentId ?? null) === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const draggedIndex = siblingItems.findIndex((item) => item.id === draggedId);
  const targetIndex = siblingItems.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return categories;

  const nextSiblings = [...siblingItems];
  const [draggedItem] = nextSiblings.splice(draggedIndex, 1);
  const baseIndex = nextSiblings.findIndex((item) => item.id === targetId);
  const insertIndex = baseIndex + (position === "after" ? 1 : 0);
  nextSiblings.splice(insertIndex, 0, draggedItem);

  const nextOrders = new Map(nextSiblings.map((item, index) => [item.id, index]));
  return normalizeCategories(
    categories.map((item) => ({
      ...item,
      sortOrder: nextOrders.get(item.id) ?? item.sortOrder,
    }))
  );
}

export default function AdminCategoriesPage({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(normalizeCategories(initialCategories));
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  const groupedCategories = useMemo(() => groupByParent(categories), [categories]);

  async function refreshCategories() {
    const refreshed = await fetch("/api/admin/categories").then((response) => response.json()).catch(() => null);
    if (refreshed?.categories) setCategories(normalizeCategories(refreshed.categories));
  }

  async function createCategory(next?: { name: string; parentId?: string }) {
    setMsg(null);
    setLoading(true);

    const nextName = (next?.name ?? name).trim();
    const nextParentId = next?.parentId ?? "";
    const nextSlug = slugify(nextName);

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextName,
        slug: nextSlug,
        description: "",
        parentId: nextParentId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo crear la categoria."));
      return;
    }

    await refreshCategories();
    if (!next) setName("");
    setMsg("Categoria creada.");
  }

  async function saveCategory(category: Category, next: Pick<Category, "name" | "slug" | "description" | "parentId">) {
    setMsg(null);

    const res = await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo guardar la categoria."));
      return;
    }

    await refreshCategories();
    setMsg("Categoria guardada.");
  }

  async function deleteCategory(category: Category) {
    const ok = confirm(
      `Borrar categoria "${category.name}"?\n\nSus ${category._count.products} producto(s) quedaran sin categoria.`
    );
    if (!ok) return;

    setMsg(null);
    const res = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo borrar la categoria."));
      return;
    }

    await refreshCategories();
    setMsg("Categoria borrada.");
  }

  async function persistReorder(parentId: string | null, orderedIds: string[]) {
    const res = await fetch("/api/admin/categories/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentId, orderedIds }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      await refreshCategories();
      setMsg(String(data?.error || "No se pudo guardar el orden."));
      return false;
    }

    setMsg("Orden actualizado.");
    return true;
  }

  async function handleDrop(targetId: string, position: "before" | "after") {
    if (!dragState) return;

    const dragged = categories.find((item) => item.id === dragState.id);
    const target = categories.find((item) => item.id === targetId);
    if (!dragged || !target) return;
    if ((dragged.parentId ?? null) !== (target.parentId ?? null)) return;

    const nextCategories = reorderSiblings(categories, dragState.id, targetId, position);
    setCategories(nextCategories);
    setDropHint(null);
    setDragState(null);

    const parentId = target.parentId ?? null;
    const orderedIds = nextCategories
      .filter((item) => (item.parentId ?? null) === parentId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((item) => item.id);

    await persistReorder(parentId, orderedIds);
  }

  return (
    <main className="min-h-screen bg-stone-50 text-stone-900">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Categorias</h1>
            <p className="mt-1 text-sm text-stone-500">
              {categories.length} categoria{categories.length === 1 ? "" : "s"}
            </p>
          </div>

          <Link
            href="/admin/products"
            className="rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm text-stone-700 hover:bg-stone-100"
          >
            Ver productos
          </Link>
        </div>

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">Nueva categoria</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="text-xs text-stone-500">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400"
              />
            </div>
            <div className="flex items-end md:col-span-12 lg:col-span-1">
              <button
                onClick={() => createCategory()}
                disabled={loading}
                className="w-full rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {loading ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
          {msg && <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">{msg}</div>}
        </section>

        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div>
              <h2 className="text-sm font-semibold text-stone-900">Arbol de categorias</h2>
              <p className="mt-1 text-xs text-stone-500">Arrastra para reordenar. Las subcategorias solo cambian dentro de su mismo grupo.</p>
            </div>
          </div>

          {(groupedCategories.get("") ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-300 px-4 py-10 text-center text-sm text-stone-500">
              Todavia no hay categorias.
            </div>
          ) : (
            <CategoryBranch
              parentId={null}
              groupedCategories={groupedCategories}
              onCreateChild={createCategory}
              onSave={saveCategory}
              onDelete={deleteCategory}
              onDragStart={setDragState}
              onDragEnd={() => {
                setDragState(null);
                setDropHint(null);
              }}
              dragState={dragState}
              dropHint={dropHint}
              setDropHint={setDropHint}
              onDrop={handleDrop}
            />
          )}
        </section>
      </div>
    </main>
  );
}

function CategoryBranch({
  parentId,
  groupedCategories,
  onCreateChild,
  onSave,
  onDelete,
  onDragStart,
  onDragEnd,
  dragState,
  dropHint,
  setDropHint,
  onDrop,
}: {
  parentId: string | null;
  groupedCategories: Map<string, Category[]>;
  onCreateChild: (next?: { name: string; parentId?: string }) => Promise<void>;
  onSave: (category: Category, next: Pick<Category, "name" | "slug" | "description" | "parentId">) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
  dragState: DragState | null;
  dropHint: DropHint | null;
  setDropHint: (hint: DropHint | null) => void;
  onDrop: (targetId: string, position: "before" | "after") => Promise<void>;
}) {
  const items = groupedCategories.get(parentId ?? "") ?? [];

  return (
    <div className="space-y-3">
      {items.map((category) => (
        <div key={category.id} className="space-y-3">
          <CategoryRow
            category={category}
            onCreateChild={onCreateChild}
            onSave={onSave}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            dragState={dragState}
            dropHint={dropHint}
            setDropHint={setDropHint}
            onDrop={onDrop}
          />

          {(groupedCategories.get(category.id) ?? []).length > 0 && (
            <div className="space-y-3">
              <CategoryBranch
                parentId={category.id}
                groupedCategories={groupedCategories}
                onCreateChild={onCreateChild}
                onSave={onSave}
                onDelete={onDelete}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                dragState={dragState}
                dropHint={dropHint}
                setDropHint={setDropHint}
                onDrop={onDrop}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CategoryRow({
  category,
  onCreateChild,
  onSave,
  onDelete,
  onDragStart,
  onDragEnd,
  dragState,
  dropHint,
  setDropHint,
  onDrop,
}: {
  category: Category;
  onCreateChild: (next: { name: string; parentId?: string }) => Promise<void>;
  onSave: (category: Category, next: Pick<Category, "name" | "slug" | "description" | "parentId">) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
  dragState: DragState | null;
  dropHint: DropHint | null;
  setDropHint: (hint: DropHint | null) => void;
  onDrop: (targetId: string, position: "before" | "after") => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [childName, setChildName] = useState("");
  const [addingChild, setAddingChild] = useState(false);
  const slug = slugify(name);
  const depth = category.depth ?? 0;
  const style = getLevelStyle(depth);
  const dirty = name !== category.name || slug !== category.slug;
  const canReceiveDrop = !dragState || (dragState.parentId ?? null) === (category.parentId ?? null);
  const showTopHint = dropHint?.targetId === category.id && dropHint.position === "before";
  const showBottomHint = dropHint?.targetId === category.id && dropHint.position === "after";

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm ${style.border} ${
        dragState?.id === category.id ? "opacity-60" : ""
      }`}
      style={{ marginLeft: `${Math.min(depth, 5) * 18}px` }}
      onDragOver={(event) => {
        if (!canReceiveDrop) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        if (dropHint?.targetId !== category.id || dropHint.position !== position) {
          setDropHint({ targetId: category.id, position });
        }
      }}
      onDrop={async (event) => {
        if (!canReceiveDrop) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        await onDrop(category.id, position);
      }}
    >
      {showTopHint && <div className="absolute inset-x-3 top-0 h-1 rounded-full bg-amber-500" />}
      {showBottomHint && <div className="absolute inset-x-3 bottom-0 h-1 rounded-full bg-amber-500" />}
      <div className="absolute inset-y-0 left-0 w-px bg-stone-200" />
      {depth > 0 && <div className="absolute left-0 top-8 h-px w-4 bg-stone-300" />}
      <div className={`absolute left-0 top-0 h-full w-1 ${style.accent}`} />

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[auto_minmax(0,0.85fr)_auto]">
        <div
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = "move";
            onDragStart({ id: category.id, parentId: category.parentId ?? null });
          }}
          onDragEnd={onDragEnd}
          className="mt-8 flex h-10 w-10 cursor-grab items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-400 active:cursor-grabbing"
          title="Arrastrar para reordenar"
        >
          <span className="text-lg leading-none">⋮⋮</span>
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${style.chip}`}>
              {getDepthLabel(depth)}
            </span>
            <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] text-stone-500">
              /{category.slug}
            </span>
          </div>

          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400"
          />
        </div>

        <div className="flex flex-col gap-3 lg:items-end">
          <Link
            href={`/admin/products?category=${category.slug}`}
            className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100"
          >
            {category._count.products} producto{category._count.products === 1 ? "" : "s"}
          </Link>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              onClick={() => setAddingChild((prev) => !prev)}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100"
            >
              {addingChild ? "Cancelar +" : "+ Subcategoria"}
            </button>
            <button
              onClick={() =>
                onSave(category, {
                  name,
                  slug,
                  description: category.description ?? null,
                  parentId: category.parentId ?? "",
                })
              }
              disabled={!dirty}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 hover:bg-stone-100 disabled:opacity-40"
            >
              Guardar cambios
            </button>
            <button
              onClick={() => onDelete(category)}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 hover:bg-rose-100"
            >
              Borrar
            </button>
          </div>
        </div>
      </div>

      {addingChild && (
        <div className="border-t border-stone-200 bg-stone-50/80 px-4 py-4">
          <div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-500">
            Nueva subcategoria dentro de {category.name}
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <input
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              placeholder="Nombre de la subcategoria"
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400"
            />
            <button
              onClick={async () => {
                const trimmedName = childName.trim();
                if (!trimmedName) return;
                await onCreateChild({ name: trimmedName, parentId: category.id });
                setChildName("");
                setAddingChild(false);
              }}
              className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
            >
              Crear subcategoria
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
