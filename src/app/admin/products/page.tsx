import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

type AdminProductsSearchParams = { q?: string; page?: string; status?: string; sort?: string };

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
  include: { images: { orderBy: { sortOrder: "asc" }; take: 1 } };
}>;

type ProductGroup = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  price: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  images: ListedProduct["images"];
  products: ListedProduct[];
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
        images: product.images,
        products: [product],
      });
      continue;
    }

    existing.products.push(product);
    existing.stock += product.stock;
    existing.price = Math.min(existing.price, price);
    existing.createdAt = existing.createdAt > product.createdAt ? existing.createdAt : product.createdAt;
    existing.isActive = existing.isActive || product.isActive;
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

  // status: all | active | inactive | oos
  const status = (resolvedSearchParams.status ?? "all").toLowerCase();
  // sort: newest | name | price_asc | price_desc | stock_asc | stock_desc
  const sort = (resolvedSearchParams.sort ?? "newest").toLowerCase();

  const where: Prisma.ProductWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { slug: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;

  const allProducts = await prisma.product.findMany({
    where,
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  let productGroups = groupProducts(allProducts);
  if (status === "oos") productGroups = productGroups.filter((group) => group.stock <= 0);

  productGroups.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    if (sort === "stock_asc") return a.stock - b.stock;
    if (sort === "stock_desc") return b.stock - a.stock;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const total = productGroups.length;
  const products = productGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const baseParams = { q, status, sort };
  const exportHref = buildHref("/api/admin/products/export", baseParams);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Productos</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {total} resultado{total === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              Volver
            </Link>
            <Link
              href="/admin/products/import"
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              Importar XLSX
            </Link>
            <a
              href={exportHref}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              Exportar XLSX
            </a>
            <Link
              href="/admin/products/new"
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              + Nuevo
            </Link>
          </div>
        </div>

        {/* Filtros */}
        <form className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-6">
              <label className="text-xs text-zinc-400">Buscar</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Nombre, slug o descripción…"
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-zinc-400">Estado</label>
              <select
                name="status"
                defaultValue={status}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
                <option value="oos">Sin stock</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="text-xs text-zinc-400">Orden</label>
              <select
                name="sort"
                defaultValue={sort}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="newest">Más nuevos</option>
                <option value="name">Nombre A→Z</option>
                <option value="price_asc">Precio ↑</option>
                <option value="price_desc">Precio ↓</option>
                <option value="stock_asc">Stock ↑</option>
                <option value="stock_desc">Stock ↓</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
              Aplicar
            </button>

            <Link
              href="/admin/products"
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              Limpiar
            </Link>

            <div className="ml-auto text-xs text-zinc-500">
              Página {page} de {totalPages}
            </div>
          </div>
        </form>

        {/* Tabla */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-zinc-900/40">
                <tr className="text-left text-xs text-zinc-400">
                  <th className="px-4 py-3">Producto</th>
                  <th className="px-4 py-3">Precio</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-800 bg-zinc-950/20">
                {products.map((p) => {
                  const img = p.images?.[0]?.url;
                  const isOos = p.stock <= 0;
                  const variantsCount = p.products.length;
                  return (
                    <tr key={p.id} className="text-sm">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img ?? "https://placehold.co/80x80/png?text=Fika"}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{p.name}</div>
                            <div className="mt-0.5 truncate text-xs text-zinc-500">
                              {variantsCount} variante{variantsCount === 1 ? "" : "s"} · /products/{p.slug}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        ${p.price.toLocaleString("es-AR")}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "inline-flex min-w-8 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                              isOos
                                ? "border-rose-700/40 bg-rose-100 text-rose-800"
                                : "border-emerald-700/40 bg-emerald-100 text-emerald-800",
                            ].join(" ")}
                          >
                            {p.stock}
                          </span>
                          {isOos && <span className="text-xs font-medium text-rose-700">Sin stock</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                            p.isActive
                              ? "border-emerald-700/50 bg-emerald-100 text-emerald-900"
                              : "border-slate-600/60 bg-slate-200 text-slate-900",
                          ].join(" ")}
                        >
                          {p.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="rounded-xl border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900/60"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  );
                })}

                {products.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                      No hay productos con esos filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Paginación */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            className={[
              "rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60",
              page <= 1 ? "pointer-events-none opacity-50" : "",
            ].join(" ")}
            href={buildHref("/admin/products", { ...baseParams, page: page - 1 })}
          >
            ← Anterior
          </Link>

          <div className="text-sm text-zinc-400">
            Página <span className="text-zinc-200">{page}</span> / {totalPages}
          </div>

          <Link
            className={[
              "rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60",
              page >= totalPages ? "pointer-events-none opacity-50" : "",
            ].join(" ")}
            href={buildHref("/admin/products", { ...baseParams, page: page + 1 })}
          >
            Siguiente →
          </Link>
        </div>
      </div>
    </main>
  );
}
