"use client";

import Link from "next/link";
import { useState } from "react";
import { slugify } from "@/lib/slug";

type Category = {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  label?: string;
  depth?: number;
  description: string | null;
  _count: { products: number };
};

function sortCategories(categories: Category[]) {
  return [...categories].sort((a, b) => (a.label ?? a.name).localeCompare(b.label ?? b.name));
}

export default function AdminCategoriesPage({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function createCategory() {
    setMsg(null);
    setLoading(true);

    const res = await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, description, parentId }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo crear la categoria."));
      return;
    }

    const refreshed = await fetch("/api/admin/categories").then((response) => response.json()).catch(() => null);
    if (refreshed?.categories) {
      setCategories(refreshed.categories);
    } else {
    setCategories((prev) => sortCategories([...prev, data.category]));
    }
    setName("");
    setSlug("");
    setDescription("");
    setParentId("");
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

    const refreshed = await fetch("/api/admin/categories").then((response) => response.json()).catch(() => null);
    if (refreshed?.categories) {
      setCategories(refreshed.categories);
    } else {
      setCategories((prev) => sortCategories(prev.map((item) => (item.id === category.id ? data.category : item))));
    }
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

    const refreshed = await fetch("/api/admin/categories").then((response) => response.json()).catch(() => null);
    if (refreshed?.categories) {
      setCategories(refreshed.categories);
    } else {
      setCategories((prev) => prev.filter((item) => item.id !== category.id));
    }
    setMsg("Categoria borrada.");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Categorias</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {categories.length} categoria{categories.length === 1 ? "" : "s"}
            </p>
          </div>

          <Link
            href="/admin/products"
            className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
          >
            Ver productos
          </Link>
        </div>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-sm font-semibold">Nueva categoria</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="text-xs text-zinc-400">Nombre</label>
              <input
                value={name}
                onChange={(e) => {
                  const value = e.target.value;
                  setName(value);
                  setSlug(slugify(value));
                }}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-4">
              <label className="text-xs text-zinc-400">Categoria padre</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">Sin padre</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label ?? category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-zinc-400">Descripcion</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end md:col-span-12 lg:col-span-1">
              <button
                onClick={createCategory}
                disabled={loading}
                className="w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
              >
                {loading ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
          {msg && <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">{msg}</div>}
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-900/40">
                <tr className="text-left text-xs text-zinc-400">
                  <th className="px-4 py-3">Nombre</th>
                  <th className="px-4 py-3">Padre</th>
                  <th className="px-4 py-3">Descripcion</th>
                  <th className="px-4 py-3">Productos</th>
                  <th className="px-4 py-3">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800 bg-zinc-950/20">
                {categories.map((category) => (
                  <CategoryRow
                    key={`${category.id}-${category.parentId ?? ""}-${category.name}-${category.slug}-${category.description ?? ""}`}
                    category={category}
                    categories={categories}
                    onSave={saveCategory}
                    onDelete={deleteCategory}
                  />
                ))}

                {categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                      Todavia no hay categorias.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function CategoryRow({
  category,
  categories,
  onSave,
  onDelete,
}: {
  category: Category;
  categories: Category[];
  onSave: (category: Category, next: Pick<Category, "name" | "slug" | "description" | "parentId">) => Promise<void>;
  onDelete: (category: Category) => Promise<void>;
}) {
  const [name, setName] = useState(category.name);
  const [description, setDescription] = useState(category.description ?? "");
  const [parentId, setParentId] = useState(category.parentId ?? "");
  const slug = slugify(name);
  const dirty =
    name !== category.name ||
    slug !== category.slug ||
    description !== (category.description ?? "") ||
    parentId !== (category.parentId ?? "");

  return (
    <tr className="text-sm">
      <td className="px-4 py-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5"
        />
      </td>
      <td className="px-4 py-3">
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-xs"
        >
          <option value="">Sin padre</option>
          {categories
            .filter((item) => item.id !== category.id)
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.label ?? item.name}
              </option>
            ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5"
        />
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/admin/products?category=${category.slug}`}
          className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-200 hover:bg-zinc-900/60"
        >
          {category._count.products}
        </Link>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSave(category, { name, slug, description: description || null, parentId })}
            disabled={!dirty}
            className="rounded-xl border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900/60 disabled:opacity-40"
          >
            Guardar
          </button>
          <button
            onClick={() => onDelete(category)}
            className="rounded-xl border border-red-900/40 bg-red-900/20 px-3 py-1.5 text-xs text-red-200 hover:bg-red-900/30"
          >
            Borrar
          </button>
        </div>
      </td>
    </tr>
  );
}
