import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import SiteHeader from "@/components/SiteHeader";
import { getAutomaticDiscountsForProducts } from "@/lib/promotions";

const PAGE_SIZE = 18;

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


export default async function HomePage({
  searchParams,
}: {
  searchParams:
    | { q?: string; page?: string; availability?: string; sort?: string }
    | Promise<{ q?: string; page?: string; availability?: string; sort?: string }>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const q = (resolvedSearchParams.q ?? "").trim();
  const page = toInt(resolvedSearchParams.page ?? "1", 1);

  // availability: available | all | oos
  const availability = (resolvedSearchParams.availability ?? "available").toLowerCase();
  // sort: newest | price_asc | price_desc | stock_desc
  const sort = (resolvedSearchParams.sort ?? "newest").toLowerCase();

  const where: Prisma.ProductWhereInput = { isActive: true };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { slug: { contains: q } },
      { description: { contains: q } },
    ];
  }

  const allProducts = await prisma.product.findMany({
    where,
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  let productGroups = groupProducts(allProducts);

  if (availability === "available") {
    productGroups = productGroups.filter((group) => group.stock > 0);
  } else if (availability === "oos") {
    productGroups = productGroups.filter((group) => group.stock <= 0);
  }

  productGroups.sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    if (sort === "stock_desc") return b.stock - a.stock;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const total = productGroups.length;
  const products = productGroups.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const promoMap = await getAutomaticDiscountsForProducts(products.map((p) => p.id));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = { q, availability, sort };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <SiteHeader>
          <form className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-6">
                <label className="text-xs text-zinc-400">Buscar</label>
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Buscar productos…"
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-3">
                <label className="text-xs text-zinc-400">Disponibilidad</label>
                <select
                  name="availability"
                  defaultValue={availability}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                >
                  <option value="available">Disponibles</option>
                  <option value="all">Todos</option>
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
                  <option value="newest">Nuevos</option>
                  <option value="price_asc">Precio ↑</option>
                  <option value="price_desc">Precio ↓</option>
                  <option value="stock_desc">Mayor stock</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
                Aplicar
              </button>

              <Link
                href="/"
                className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
              >
                Limpiar
              </Link>

              <div className="ml-auto text-xs text-zinc-500">
                {total} resultado{total === 1 ? "" : "s"} · Página {page}/{totalPages}
              </div>
            </div>
          </form>
        </SiteHeader>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
            <p className="text-zinc-300">No hay productos con esos filtros.</p>
          </div>
        ) : (
          <>
            <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const img =
                  p.images[0]?.url ?? "https://placehold.co/900x900/png?text=Fika";
                const isOos = p.stock <= 0;
                const basePrice = p.price;
                const promoPercent = promoMap.get(p.id) ?? 0;
                const finalPrice =
                  promoPercent > 0 ? Math.round(basePrice * (1 - promoPercent / 100) * 100) / 100 : basePrice;

                const Card = (
                  <div className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/50">
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={p.name}
                        className={[
                          "h-full w-full object-cover transition",
                          isOos ? "opacity-60" : "group-hover:scale-[1.02]",
                        ].join(" ")}
                      />

                      {isOos && (
                        <span className="absolute left-3 top-3 rounded-full border border-amber-900/40 bg-amber-900/20 px-3 py-1 text-xs text-amber-200">
                          Sin stock
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-medium">{p.name}</h2>
                        <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
                          {p.products.length > 1
                            ? `${p.products.length} variantes disponibles`
                            : p.description ?? "Producto Fika"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {promoPercent > 0 ? (
                          <>
                            <div className="text-xs text-zinc-500 line-through">
                              ${basePrice.toLocaleString("es-AR")}
                            </div>
                            <div className="text-base font-semibold">
                              ${finalPrice.toLocaleString("es-AR")}{" "}
                              <span className="text-xs text-zinc-400">({promoPercent}% OFF)</span>
                            </div>
                          </>
                        ) : (
                          <div className="text-base font-semibold">
                            ${basePrice.toLocaleString("es-AR")}
                          </div>
                        )}
                      </div>
                    </div>

                    {isOos && (
                      <div className="mt-3 text-xs text-zinc-500">
                        * Próximamente disponible.
                      </div>
                    )}
                  </div>
                );

                return (
  <Link key={p.id} href={`/products/${p.slug}`} className="block">
    {Card}
  </Link>
);

              })}
            </section>

            {/* Paginación */}
            <div className="mt-8 flex items-center justify-between">
              <Link
                className={[
                  "rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60",
                  page <= 1 ? "pointer-events-none opacity-50" : "",
                ].join(" ")}
                href={buildHref("/", { ...baseParams, page: page - 1 })}
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
                href={buildHref("/", { ...baseParams, page: page + 1 })}
              >
                Siguiente →
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
