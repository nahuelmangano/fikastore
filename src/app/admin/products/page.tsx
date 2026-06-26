import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { flattenCategories, getCategoryAndDescendantIds } from "@/lib/categories";
import AdminProductsTable from "./AdminProductsTable";
import BulkCategoryToolbar from "./BulkCategoryToolbar";
import CategoryFilterSelect from "./CategoryFilterSelect";

const PAGE_SIZE = 20;

type AdminProductsSearchParams = { q?: string; page?: string; status?: string; sort?: string; category?: string };

function toInt(v: string | null, def: number) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : def;
}

function buildHref(base: string, params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
}

type ListedProduct = Prisma.ProductGetPayload<{
  include: { images: { orderBy: { sortOrder: "asc" }; take: 1 }; category: true };
}>;

type ProductGroup = {
  id: string;
  sortOrder: number;
  name: string;
  description: string | null;
  slug: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  categories: Array<{ name: string; slug: string }>;
  images: ListedProduct["images"];
  products: Array<{ id: string }>;
};

function groupProducts(products: ListedProduct[]) {
  const groups = new Map<string, ProductGroup>();

  for (const product of products) {
    const { baseName } = splitProductName(product.name);
    const key = baseName.toLowerCase();
    const price = Number(product.price);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        id: product.id,
        sortOrder: product.sortOrder,
        name: baseName,
        description: product.description,
        slug: product.slug,
        price,
        stock: product.stock,
        isActive: product.isActive,
        createdAt: product.createdAt,
        categories: product.category ? [{ name: product.category.name, slug: product.category.slug }] : [],
        images: product.images,
        products: [{ id: product.id }],
      });
      continue;
    }

    existing.products.push({ id: product.id });
    existing.stock += product.stock;
    existing.price = Math.min(existing.price, price);
    existing.sortOrder = Math.min(existing.sortOrder, product.sortOrder);
    existing.createdAt = existing.createdAt > product.createdAt ? existing.createdAt : product.createdAt;
    existing.isActive = existing.isActive || product.isActive;
    if (product.category && !existing.categories.some((category) => category.slug === product.category?.slug)) {
      existing.categories.push({ name: product.category.name, slug: product.category.slug });
    }
    if (!existing.description && product.description) existing.description = product.description;
    if (existing.images.length === 0 && product.images.length > 0) existing.images = product.images;
  }

  return Array.from(groups.values());
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: AdminProductsSearchParams | Promise<AdminProductsSearchParams>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const q = (resolvedSearchParams.q ?? "").trim();
  const page = toInt(resolvedSearchParams.page ?? "1", 1);
  const category = (resolvedSearchParams.category ?? "all").trim();
  const status = (resolvedSearchParams.status ?? "all").toLowerCase();
  const sort = (resolvedSearchParams.sort ?? "manual").toLowerCase();

  const where: Prisma.ProductWhereInput = {};

  if (q) {
    where.OR = [{ name: { contains: q } }, { slug: { contains: q } }, { description: { contains: q } }];
  }
  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (category === "uncategorized") where.categoryId = null;
  if (category && category !== "all" && category !== "uncategorized") {
    const categoryIds = await getCategoryAndDescendantIds(category);
    where.categoryId = categoryIds.length > 0 ? { in: categoryIds } : "__missing__";
  }

  const [allProducts, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, category: true },
    }),
    prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, slug: true, sortOrder: true },
    }),
  ]);

  let productGroups = groupProducts(allProducts);
  if (status === "oos") productGroups = productGroups.filter((group) => group.stock <= 0);

  productGroups.sort((a, b) => {
    if (sort === "manual") {
      const orderDiff = a.sortOrder - b.sortOrder;
      if (orderDiff !== 0) return orderDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    }
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    if (sort === "stock_asc") return a.stock - b.stock;
    if (sort === "stock_desc") return b.stock - a.stock;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const manualOrder = sort === "manual";
  const total = productGroups.length;
  const totalPages = manualOrder ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const products = manualOrder ? productGroups : productGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const baseParams = { q, status, sort, category };
  const exportHref = buildHref("/api/admin/products/export", baseParams);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Productos</h1>
            <p className="mt-1 text-sm text-zinc-400">{total} resultado{total === 1 ? "" : "s"}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/admin" className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60">
              Volver
            </Link>
            <Link href="/admin/products/import" className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60">
              Importar XLSX
            </Link>
            <a href={exportHref} className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60">
              Exportar XLSX
            </a>
            <Link href="/admin/products/new" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
              + Nuevo
            </Link>
          </div>
        </div>

        <form className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <input type="hidden" name="page" value="1" />
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="text-xs text-zinc-400">Buscar</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Nombre, slug o descripcion..."
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-zinc-400">Estado</label>
              <select name="status" defaultValue={status} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="oos">Sin stock</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-zinc-400">Filtrar por categoria</label>
              <CategoryFilterSelect categories={flattenCategories(categories)} value={category} />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-zinc-400">Orden</label>
              <select name="sort" defaultValue={sort} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm">
                <option value="manual">Manual</option>
                <option value="newest">Mas nuevos</option>
                <option value="name">Nombre A-Z</option>
                <option value="price_asc">Precio ↑</option>
                <option value="price_desc">Precio ↓</option>
                <option value="stock_asc">Stock ↑</option>
                <option value="stock_desc">Stock ↓</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">Aplicar</button>
            <Link href="/admin/products" className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60">
              Limpiar
            </Link>
            <div className="ml-auto text-xs text-zinc-500">
              {manualOrder ? "Orden manual activo" : `Pagina ${page} de ${totalPages}`}
            </div>
          </div>
        </form>

        <BulkCategoryToolbar categories={flattenCategories(categories)} />

        <AdminProductsTable initialProducts={products} baseParams={baseParams} manualOrder={manualOrder} />

        {!manualOrder && (
          <div className="mt-6 flex items-center justify-between">
            <Link
              className={["rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60", page <= 1 ? "pointer-events-none opacity-50" : ""].join(" ")}
              href={buildHref("/admin/products", { ...baseParams, page: page - 1 })}
            >
              ← Anterior
            </Link>

            <div className="text-sm text-zinc-400">
              Pagina <span className="text-zinc-200">{page}</span> / {totalPages}
            </div>

            <Link
              className={["rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60", page >= totalPages ? "pointer-events-none opacity-50" : ""].join(" ")}
              href={buildHref("/admin/products", { ...baseParams, page: page + 1 })}
            >
              Siguiente →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
