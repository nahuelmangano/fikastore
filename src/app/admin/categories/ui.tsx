"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  GripVertical,
  Layers3,
  Package,
  Plus,
  Search,
  Tags,
} from "lucide-react";
import { flattenCategories } from "@/lib/categories";
import { slugify } from "@/lib/slug";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import PageToolbar from "@/components/admin/layout/PageToolbar";
import SectionCard from "@/components/admin/cards/SectionCard";
import StatCard from "@/components/admin/cards/StatCard";
import EmptyState from "@/components/admin/data/EmptyState";
import FilterChips from "@/components/admin/data/FilterChips";
import SearchBar from "@/components/admin/data/SearchBar";
import StatusBadge from "@/components/admin/data/StatusBadge";
import ConfirmDialog from "@/components/admin/feedback/ConfirmDialog";

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

type CategoryFilter = "all" | "roots" | "children" | "empty";

type CategoryFormState = {
  name: string;
  slug: string;
  description: string;
  parentId: string;
};

function normalizeCategories(categories: Category[]) {
  return flattenCategories(categories).map((category) => ({
    ...category,
    sortOrder: category.sortOrder ?? 0,
  }));
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

function reorderSiblings(categories: Category[], draggedId: string, targetId: string, position: "before" | "after") {
  const dragged = categories.find((item) => item.id === draggedId);
  const target = categories.find((item) => item.id === targetId);
  if (!dragged || !target) return categories;
  if ((dragged.parentId ?? null) !== (target.parentId ?? null)) return categories;

  const parentId = dragged.parentId ?? null;
  const siblings = categories
    .filter((item) => (item.parentId ?? null) === parentId)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const draggedIndex = siblings.findIndex((item) => item.id === draggedId);
  const targetIndex = siblings.findIndex((item) => item.id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return categories;

  const nextSiblings = [...siblings];
  const [draggedItem] = nextSiblings.splice(draggedIndex, 1);
  const baseIndex = nextSiblings.findIndex((item) => item.id === targetId);
  nextSiblings.splice(baseIndex + (position === "after" ? 1 : 0), 0, draggedItem);

  const nextOrders = new Map(nextSiblings.map((item, index) => [item.id, index]));
  return normalizeCategories(
    categories.map((item) => ({
      ...item,
      sortOrder: nextOrders.get(item.id) ?? item.sortOrder,
    }))
  );
}

function categoryMatchesFilter(category: Category, filter: CategoryFilter) {
  if (filter === "roots") return (category.depth ?? 0) === 0;
  if (filter === "children") return (category.depth ?? 0) > 0;
  if (filter === "empty") return category._count.products === 0;
  return true;
}

function collectVisibleIds(categories: Category[], filter: CategoryFilter, query: string) {
  const visible = new Set<string>();
  const byId = new Map(categories.map((category) => [category.id, category]));
  const normalizedQuery = query.trim().toLowerCase();

  for (const category of categories) {
    const matchesText =
      !normalizedQuery ||
      category.name.toLowerCase().includes(normalizedQuery) ||
      category.slug.toLowerCase().includes(normalizedQuery);
    if (!matchesText || !categoryMatchesFilter(category, filter)) continue;

    visible.add(category.id);
    let parentId = category.parentId ?? null;
    while (parentId) {
      const parent = byId.get(parentId);
      if (!parent) break;
      visible.add(parent.id);
      parentId = parent.parentId ?? null;
    }
  }

  return visible;
}

function defaultExpandedIds(categories: Category[]) {
  return new Set(categories.filter((category) => categories.some((child) => child.parentId === category.id)).map((category) => category.id));
}

function createFormState(parentId = ""): CategoryFormState {
  return { name: "", slug: "", description: "", parentId };
}

export default function AdminCategoriesPage({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(normalizeCategories(initialCategories));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => defaultExpandedIds(normalizeCategories(initialCategories)));
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CategoryFormState>(createFormState());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);

  const groupedCategories = useMemo(() => groupByParent(categories), [categories]);
  const visibleIds = useMemo(() => collectVisibleIds(categories, filter, query), [categories, filter, query]);
  const rootCategories = groupedCategories.get("") ?? [];
  const summary = {
    total: categories.length,
    roots: categories.filter((category) => (category.depth ?? 0) === 0).length,
    children: categories.filter((category) => (category.depth ?? 0) > 0).length,
    empty: categories.filter((category) => category._count.products === 0).length,
  };
  const hasActiveSearch = query.trim() || filter !== "all";

  async function refreshCategories() {
    const refreshed = await fetch("/api/admin/categories").then((response) => response.json()).catch(() => null);
    if (refreshed?.categories) {
      const nextCategories = normalizeCategories(refreshed.categories);
      setCategories(nextCategories);
      setExpandedIds((current) => new Set([...current, ...defaultExpandedIds(nextCategories)]));
    }
  }

  async function createCategory(nextForm = form) {
    setMsg(null);
    const nextName = nextForm.name.trim();
    const nextSlug = slugify(nextForm.slug || nextName);
    if (!nextName) {
      setMsg("Ingresá un nombre para crear la categoría.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextName,
        slug: nextSlug,
        description: nextForm.description.trim(),
        parentId: nextForm.parentId,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo crear la categoría."));
      return;
    }

    await refreshCategories();
    if (nextForm.parentId) setExpandedIds((current) => new Set(current).add(nextForm.parentId));
    setForm(createFormState());
    setCreateOpen(false);
    setMsg("Categoría creada.");
  }

  async function saveCategory(category: Category, next: Pick<Category, "name" | "slug" | "description" | "parentId">) {
    setMsg(null);
    setLoading(true);
    const res = await fetch(`/api/admin/categories/${category.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo guardar la categoría."));
      return;
    }

    await refreshCategories();
    setEditingId(null);
    setMsg("Categoría guardada.");
  }

  async function deleteCategory(category: Category) {
    setMsg(null);
    setLoading(true);
    const res = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo borrar la categoría."));
      return;
    }

    setDeleteTarget(null);
    await refreshCategories();
    setMsg("Categoría borrada.");
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

  function openCreate(parentId = "") {
    setForm(createFormState(parentId));
    setCreateOpen(true);
  }

  return (
    <main className="min-h-screen bg-[var(--admin-background)] text-[var(--admin-text-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <AdminPageHeader
          eyebrow="Admin · Catálogo"
          title="Categorías"
          subtitle={`Organizá el catálogo y definí la estructura de navegación de tu tienda. ${summary.total} categorías · ${summary.roots} principales · ${summary.children} subcategorías.`}
          backHref="/admin"
          actions={
            <>
              <Link
                href="/admin/products"
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-white/70 px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] shadow-sm transition duration-150 hover:bg-[var(--admin-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              >
                <Package className="h-4 w-4" aria-hidden="true" />
                Ver productos
              </Link>
              <button
                type="button"
                onClick={() => openCreate()}
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[var(--admin-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nueva categoría
              </button>
            </>
          }
        />

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Categorías" value={summary.total} description="Total del árbol" icon={FolderTree} />
          <StatCard title="Principales" value={summary.roots} description="Primer nivel" icon={Layers3} />
          <StatCard title="Subcategorías" value={summary.children} description="Niveles secundarios" icon={Tags} />
          <StatCard title="Sin productos" value={summary.empty} description="Categorías vacías" icon={Search} />
        </section>

        {msg ? (
          <div className="mt-6 xl:mt-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text-soft)] shadow-[var(--admin-shadow)]">
            {msg}
          </div>
        ) : null}

        <SectionCard className="mt-8 xl:mt-6">
          <PageToolbar
            title="Árbol de categorías"
            description="Arrastrá para reordenar categorías dentro del mismo nivel."
            search={<SearchBar value={query} onChange={setQuery} placeholder="Buscar categoría..." ariaLabel="Buscar categoría" />}
            actions={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExpandedIds(new Set(categories.map((category) => category.id)))}
                  className="rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
                >
                  Expandir todas
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedIds(new Set())}
                  className="rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
                >
                  Contraer todas
                </button>
              </div>
            }
            filters={
              <FilterChips
                ariaLabel="Filtros de categorías"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "Todas", count: summary.total },
                  { value: "roots", label: "Principales", count: summary.roots },
                  { value: "children", label: "Subcategorías", count: summary.children },
                  { value: "empty", label: "Sin productos", count: summary.empty },
                ]}
              />
            }
          />

          <div className="mt-6 xl:mt-4">
            {rootCategories.length === 0 ? (
              <EmptyState
                icon={FolderTree}
                title="Todavía no creaste categorías."
                description="Las categorías ayudan a organizar el catálogo y mejorar la navegación de la tienda."
                action={
                  <button
                    type="button"
                    onClick={() => openCreate()}
                    className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)]"
                  >
                    Crear primera categoría
                  </button>
                }
              />
            ) : visibleIds.size === 0 && hasActiveSearch ? (
              <EmptyState
                icon={Search}
                title="No encontramos categorías con esos filtros."
                description="Probá cambiar la búsqueda o volver al filtro Todas."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                    }}
                    className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)]"
                  >
                    Limpiar filtros
                  </button>
                }
              />
            ) : (
              <CategoryBranch
                parentId={null}
                groupedCategories={groupedCategories}
                visibleIds={visibleIds}
                expandedIds={expandedIds}
                setExpandedIds={setExpandedIds}
                editingId={editingId}
                setEditingId={setEditingId}
                categories={categories}
                onCreateChild={openCreate}
                onSave={saveCategory}
                onDelete={setDeleteTarget}
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
          </div>
        </SectionCard>
      </div>

      <CategoryCreateDialog
        open={createOpen}
        form={form}
        setForm={setForm}
        categories={categories}
        loading={loading}
        onCreate={() => createCategory()}
        onClose={() => setCreateOpen(false)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar categoría"
        description={
          deleteTarget
            ? `¿Querés eliminar "${deleteTarget.name}"? Sus ${deleteTarget._count.products} producto${deleteTarget._count.products === 1 ? "" : "s"} quedarán sin categoría.`
            : undefined
        }
        confirmLabel="Eliminar"
        variant="danger"
        loading={loading}
        onConfirm={() => {
          if (deleteTarget) void deleteCategory(deleteTarget);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </main>
  );
}

function CategoryBranch({
  parentId,
  groupedCategories,
  visibleIds,
  expandedIds,
  setExpandedIds,
  editingId,
  setEditingId,
  categories,
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
  visibleIds: Set<string>;
  expandedIds: Set<string>;
  setExpandedIds: (next: Set<string> | ((current: Set<string>) => Set<string>)) => void;
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  categories: Category[];
  onCreateChild: (parentId?: string) => void;
  onSave: (category: Category, next: Pick<Category, "name" | "slug" | "description" | "parentId">) => Promise<void>;
  onDelete: (category: Category) => void;
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
  dragState: DragState | null;
  dropHint: DropHint | null;
  setDropHint: (hint: DropHint | null) => void;
  onDrop: (targetId: string, position: "before" | "after") => Promise<void>;
}) {
  const items = (groupedCategories.get(parentId ?? "") ?? []).filter((category) => visibleIds.has(category.id));

  return (
    <div className={parentId ? "mt-3 space-y-3 border-l border-[var(--admin-border)] pl-4 sm:pl-6" : "space-y-3"}>
      {items.map((category) => {
        const childCount = groupedCategories.get(category.id)?.filter((child) => visibleIds.has(child.id)).length ?? 0;
        const expanded = expandedIds.has(category.id);
        return (
          <div key={category.id}>
            <CategoryRow
              category={category}
              childCount={childCount}
              expanded={expanded}
              onToggleExpanded={() =>
                setExpandedIds((current) => {
                  const next = new Set(current);
                  if (next.has(category.id)) next.delete(category.id);
                  else next.add(category.id);
                  return next;
                })
              }
              editing={editingId === category.id}
              setEditing={(editing) => setEditingId(editing ? category.id : null)}
              categories={categories}
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
            {childCount > 0 && expanded ? (
              <CategoryBranch
                parentId={category.id}
                groupedCategories={groupedCategories}
                visibleIds={visibleIds}
                expandedIds={expandedIds}
                setExpandedIds={setExpandedIds}
                editingId={editingId}
                setEditingId={setEditingId}
                categories={categories}
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
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CategoryRow({
  category,
  childCount,
  expanded,
  onToggleExpanded,
  editing,
  setEditing,
  categories,
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
  childCount: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  editing: boolean;
  setEditing: (editing: boolean) => void;
  categories: Category[];
  onCreateChild: (parentId?: string) => void;
  onSave: (category: Category, next: Pick<Category, "name" | "slug" | "description" | "parentId">) => Promise<void>;
  onDelete: (category: Category) => void;
  onDragStart: (state: DragState) => void;
  onDragEnd: () => void;
  dragState: DragState | null;
  dropHint: DropHint | null;
  setDropHint: (hint: DropHint | null) => void;
  onDrop: (targetId: string, position: "before" | "after") => Promise<void>;
}) {
  const [draft, setDraft] = useState<CategoryFormState>({
    name: category.name,
    slug: category.slug,
    description: category.description ?? "",
    parentId: category.parentId ?? "",
  });
  const depth = category.depth ?? 0;
  const canReceiveDrop = !dragState || (dragState.parentId ?? null) === (category.parentId ?? null);
  const showTopHint = dropHint?.targetId === category.id && dropHint.position === "before";
  const showBottomHint = dropHint?.targetId === category.id && dropHint.position === "after";
  const dirty =
    draft.name !== category.name ||
    slugify(draft.slug) !== category.slug ||
    draft.description !== (category.description ?? "") ||
    draft.parentId !== (category.parentId ?? "");

  function resetDraft() {
    setDraft({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      parentId: category.parentId ?? "",
    });
  }

  return (
    <article
      className={[
        "relative rounded-3xl border bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow)] transition duration-150",
        depth === 0 ? "border-[var(--admin-border)]" : "border-[#E6D7C8] bg-white/60",
        dragState?.id === category.id ? "scale-[0.99] opacity-60 shadow-lg" : "",
      ].join(" ")}
      onDragOver={(event) => {
        if (!canReceiveDrop) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        if (dropHint?.targetId !== category.id || dropHint.position !== position) setDropHint({ targetId: category.id, position });
      }}
      onDrop={async (event) => {
        if (!canReceiveDrop) return;
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
        await onDrop(category.id, position);
      }}
    >
      {showTopHint ? <div className="absolute inset-x-4 top-0 h-1 rounded-full bg-[var(--admin-primary)]" /> : null}
      {showBottomHint ? <div className="absolute inset-x-4 bottom-0 h-1 rounded-full bg-[var(--admin-primary)]" /> : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <button
            type="button"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              onDragStart({ id: category.id, parentId: category.parentId ?? null });
            }}
            onDragEnd={onDragEnd}
            className="mt-1 cursor-grab rounded-xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-2 text-[var(--admin-muted)] active:cursor-grabbing"
            aria-label={`Reordenar ${category.name}`}
            title="Arrastrar para reordenar"
          >
            <GripVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onToggleExpanded}
            disabled={childCount === 0}
            className="mt-1 rounded-xl p-2 text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] disabled:cursor-default disabled:opacity-30"
            aria-label={expanded ? `Contraer ${category.name}` : `Expandir ${category.name}`}
          >
            {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>

          {editing ? (
            <div className="grid min-w-0 flex-1 gap-3 md:grid-cols-2">
              <Field label="Nombre">
                <input
                  value={draft.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setDraft((current) => ({ ...current, name: nextName, slug: current.slug ? current.slug : slugify(nextName) }));
                  }}
                  className="admin-input"
                />
              </Field>
              <Field label="Slug">
                <input
                  value={draft.slug}
                  onChange={(event) => setDraft((current) => ({ ...current, slug: event.target.value }))}
                  className="admin-input"
                />
              </Field>
              <Field label="Categoría padre">
                <ParentSelect
                  categories={categories}
                  value={draft.parentId}
                  excludeId={category.id}
                  onChange={(value) => setDraft((current) => ({ ...current, parentId: value }))}
                />
              </Field>
              <Field label="Descripción">
                <input
                  value={draft.description}
                  onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                  className="admin-input"
                />
              </Field>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className={["truncate font-semibold text-[var(--admin-text)]", depth === 0 ? "text-lg" : "text-base"].join(" ")}>
                  {category.name}
                </h3>
                {depth === 0 ? <StatusBadge label="Principal" variant="brand" /> : <StatusBadge label="Subcategoría" variant="neutral" />}
                {category._count.products === 0 ? <StatusBadge label="Sin productos" variant="neutral" /> : null}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--admin-muted)]">
                <span>/{category.slug}</span>
                <span>·</span>
                <Link href={`/admin/products?category=${category.slug}`} className="font-semibold text-[var(--admin-primary)] hover:underline">
                  {category._count.products} producto{category._count.products === 1 ? "" : "s"}
                </Link>
                {childCount > 0 ? (
                  <>
                    <span>·</span>
                    <span>{childCount} subcategoría{childCount === 1 ? "" : "s"}</span>
                  </>
                ) : null}
              </div>
              {category.description ? <p className="mt-2 text-sm text-[var(--admin-muted)]">{category.description}</p> : null}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  resetDraft();
                  setEditing(false);
                }}
                className="rounded-2xl border border-[var(--admin-border)] px-3 py-2 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  void onSave(category, {
                    name: draft.name,
                    slug: slugify(draft.slug || draft.name),
                    description: draft.description || null,
                    parentId: draft.parentId,
                  })
                }
                disabled={!dirty}
                className="rounded-2xl bg-[var(--admin-primary)] px-3 py-2 text-xs font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)] disabled:opacity-50"
              >
                Guardar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-2xl border border-[var(--admin-border)] px-3 py-2 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => onCreateChild(category.id)}
                className="rounded-2xl border border-[var(--admin-border)] px-3 py-2 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
              >
                Agregar subcategoría
              </button>
              <Link
                href={`/admin/products?category=${category.slug}`}
                className="rounded-2xl border border-[var(--admin-border)] px-3 py-2 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
              >
                Ver productos
              </Link>
              <button
                type="button"
                onClick={() => onDelete(category)}
                className="rounded-2xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition duration-150 hover:bg-red-50"
              >
                Eliminar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function CategoryCreateDialog({
  open,
  form,
  setForm,
  categories,
  loading,
  onCreate,
  onClose,
}: {
  open: boolean;
  form: CategoryFormState;
  setForm: (next: CategoryFormState | ((current: CategoryFormState) => CategoryFormState)) => void;
  categories: Category[];
  loading: boolean;
  onCreate: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Cerrar formulario" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-[var(--admin-border)] bg-[var(--admin-background)] p-6 xl:p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--admin-text)]">Nueva categoría</h2>
            <p className="mt-2 text-sm text-[var(--admin-muted)]">Creá una categoría principal o asignala dentro de otra.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-[var(--admin-border)] px-3 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
          >
            Cerrar
          </button>
        </div>

        <div className="mt-6 xl:mt-4 space-y-4">
          <Field label="Nombre">
            <input
              value={form.name}
              onChange={(event) => {
                const nextName = event.target.value;
                setForm((current) => ({ ...current, name: nextName, slug: current.slug ? current.slug : slugify(nextName) }));
              }}
              className="admin-input"
              autoFocus
            />
          </Field>
          <Field label="Slug">
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
              className="admin-input"
            />
          </Field>
          <Field label="Categoría padre">
            <ParentSelect categories={categories} value={form.parentId} onChange={(value) => setForm((current) => ({ ...current, parentId: value }))} />
          </Field>
          <Field label="Descripción">
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              rows={4}
              className="admin-input resize-none"
            />
          </Field>
        </div>

        <div className="mt-8 xl:mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={loading}
            className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)] disabled:opacity-60"
          >
            {loading ? "Creando..." : "Crear categoría"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function ParentSelect({
  categories,
  value,
  excludeId,
  onChange,
}: {
  categories: Category[];
  value: string;
  excludeId?: string;
  onChange: (value: string) => void;
}) {
  const excludedDescendants = useMemo(() => {
    if (!excludeId) return new Set<string>();
    const ids = new Set([excludeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of categories) {
        if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
          ids.add(category.id);
          changed = true;
        }
      }
    }
    return ids;
  }, [categories, excludeId]);

  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className="admin-input">
      <option value="">Sin categoría padre</option>
      {categories
        .filter((category) => !excludedDescendants.has(category.id))
        .map((category) => (
          <option key={category.id} value={category.id}>
            {category.label ?? category.name}
          </option>
        ))}
    </select>
  );
}
