import Link from "next/link";
import { Download, FileUp, PackagePlus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { flattenCategories, getCategoryAndDescendantIds } from "@/lib/categories";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import PageToolbar from "@/components/admin/layout/PageToolbar";
import SectionCard from "@/components/admin/cards/SectionCard";
import StatCard from "@/components/admin/cards/StatCard";
import AdminProductsTable from "./AdminProductsTable";
import BulkCategoryToolbar from "./BulkCategoryToolbar";
import CategoryFilterSelect from "./CategoryFilterSelect";
import ProductQuickFilters from "./ProductQuickFilters";

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

type CatalogMetricProduct = {
  id: string;
  name: string;
  stock: number;
  isActive: boolean;
  categoryId: string | null;
};

type ProductGroup = {
  id: string;
  sortOrder?: number;
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

function groupMetricProducts(products: CatalogMetricProduct[]) {
  const groups = new Map<string, { stock: number; isActive: boolean; products: number; categoryIds: Set<string> }>();

  for (const product of products) {
    const { baseName } = splitProductName(product.name);
    const key = baseName.toLowerCase();
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        stock: product.stock,
        isActive: product.isActive,
        products: 1,
        categoryIds: new Set(product.categoryId ? [product.categoryId] : []),
      });
      continue;
    }
    current.stock += product.stock;
    current.isActive = current.isActive || product.isActive;
    current.products += 1;
    if (product.categoryId) current.categoryIds.add(product.categoryId);
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
  const sort = (resolvedSearchParams.sort ?? "newest").toLowerCase();

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

  const [allProducts, catalogProducts, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 }, category: true },
    }),
    prisma.product.findMany({
      select: { id: true, name: true, stock: true, isActive: true, categoryId: true },
    }),
    prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, slug: true },
    }),
  ]);

  let productGroups = groupProducts(allProducts);
  if (status === "oos") productGroups = productGroups.filter((group) => group.stock <= 0);
  if (status === "low") productGroups = productGroups.filter((group) => group.stock > 0 && group.stock < 5);
  if (status === "variants") productGroups = productGroups.filter((group) => group.products.length > 1);

  productGroups.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    if (sort === "stock_asc") return a.stock - b.stock;
    if (sort === "stock_desc") return b.stock - a.stock;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const manualOrder = false;
  const total = productGroups.length;
  const totalPages = manualOrder ? 1 : Math.max(1, Math.ceil(total / PAGE_SIZE));
  const products = manualOrder ? productGroups : productGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const baseParams = { q, status, sort, category };
  const returnHref = buildHref("/admin/products", { ...baseParams, page });
  const exportHref = buildHref("/api/admin/products/export", baseParams);
  const flatCategories = flattenCategories(categories);
  const catalogGroups = groupMetricProducts(catalogProducts);
  const catalogSummary = {
    products: catalogGroups.length,
    variants: catalogProducts.length,
    active: catalogGroups.filter((group) => group.isActive).length,
    outOfStock: catalogGroups.filter((group) => group.stock <= 0).length,
    lowStock: catalogGroups.filter((group) => group.stock > 0 && group.stock < 5).length,
    categories: new Set(catalogProducts.map((product) => product.categoryId).filter(Boolean)).size,
    withVariants: catalogGroups.filter((group) => group.products > 1).length,
  };
  const statusCounts = {
    all: catalogSummary.products,
    active: catalogSummary.active,
    inactive: catalogGroups.filter((group) => !group.isActive).length,
    oos: catalogSummary.outOfStock,
    low: catalogSummary.lowStock,
    variants: catalogSummary.withVariants,
  };

  return (
    <main className="min-h-screen bg-[var(--admin-background)] text-[var(--admin-text-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <AdminPageHeader
          eyebrow="Admin · Catálogo"
          title="Productos"
          subtitle={`Administrá el catálogo, precios, variantes y stock de tu tienda. ${catalogSummary.products} productos · ${catalogSummary.variants} variantes · ${catalogSummary.outOfStock} sin stock.`}
          backHref="/admin"
          actions={
            <>
              <Link
                href="/admin/products/import"
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-white/70 px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] shadow-sm transition duration-150 hover:bg-[var(--admin-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              >
                <FileUp className="h-4 w-4" aria-hidden="true" />
                Importar XLSX
              </Link>
              <a
                href={exportHref}
                className="inline-flex items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-white/70 px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] shadow-sm transition duration-150 hover:bg-[var(--admin-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                Exportar XLSX
              </a>
              <Link
                href="/admin/products/new"
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[var(--admin-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              >
                <PackagePlus className="h-4 w-4" aria-hidden="true" />
                Nuevo producto
              </Link>
            </>
          }
        />

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Productos" value={catalogSummary.products} description="Total del catálogo" icon={PackagePlus} />
          <StatCard title="Activos" value={catalogSummary.active} description="Publicados en la tienda" icon={PackagePlus} />
          <StatCard title="Sin stock" value={catalogSummary.outOfStock} description="Necesitan reposición" icon={PackagePlus} />
          <StatCard title="Variantes" value={catalogSummary.variants} description="Talles y opciones" icon={PackagePlus} />
        </section>

        <SectionCard className="mt-8 xl:mt-6">
          <PageToolbar
            title="Listado de productos"
            description={`${total} resultado${total === 1 ? "" : "s"} · ${manualOrder ? "Orden manual activo" : `Página ${page} de ${totalPages}`}`}
            filters={<ProductQuickFilters currentStatus={status} counts={statusCounts} baseParams={baseParams} />}
          />

          <form className="mt-5">
          <input type="hidden" name="page" value="1" />
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Buscar</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Buscar por nombre, SKU o variante..."
                className="mt-2 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text)] outline-none transition duration-150 placeholder:text-[var(--admin-muted-2)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Estado</label>
              <select name="status" defaultValue={status} className="mt-2 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15">
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="oos">Sin stock</option>
                <option value="low">Stock bajo</option>
                <option value="variants">Con variantes</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Categoría</label>
              <CategoryFilterSelect categories={flatCategories} value={category} />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Orden</label>
              <select name="sort" defaultValue={sort} className="mt-2 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15">
                <option value="newest">Más nuevos</option>
                <option value="name">Nombre A-Z</option>
                <option value="price_asc">Precio ↑</option>
                <option value="price_desc">Precio ↓</option>
                <option value="stock_asc">Stock ↑</option>
                <option value="stock_desc">Stock ↓</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30">Aplicar filtros</button>
            <Link href="/admin/products" className="rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]">
              Limpiar
            </Link>
            <div className="ml-auto text-sm text-[var(--admin-muted)]">{total} resultado{total === 1 ? "" : "s"}</div>
          </div>
        </form>
        </SectionCard>

        <BulkCategoryToolbar categories={flatCategories} />

        <AdminProductsTable
          key={buildHref("products", { ...baseParams, page })}
          initialProducts={products}
          baseParams={baseParams}
          returnHref={returnHref}
          manualOrder={manualOrder}
        />

        {!manualOrder && (
          <div className="mt-6 xl:mt-4 flex flex-col gap-3 rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow)] sm:flex-row sm:items-center sm:justify-between">
            <Link
              className={["rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]", page <= 1 ? "pointer-events-none opacity-50" : ""].join(" ")}
              href={buildHref("/admin/products", { ...baseParams, page: page - 1 })}
            >
              Anterior
            </Link>

            <div className="text-sm text-[var(--admin-muted)]">
              Página <span className="font-semibold text-[var(--admin-text)]">{page}</span> de {totalPages}
            </div>

            <Link
              className={["rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]", page >= totalPages ? "pointer-events-none opacity-50" : ""].join(" ")}
              href={buildHref("/admin/products", { ...baseParams, page: page + 1 })}
            >
              Siguiente
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
