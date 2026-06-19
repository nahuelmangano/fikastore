import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import ProductSortSelect from "@/components/ProductSortSelect";
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

function money(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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


export default async function ProductsPage({
  searchParams,
}: {
  searchParams:
    | { q?: string; page?: string; availability?: string; sort?: string; category?: string }
    | Promise<{ q?: string; page?: string; availability?: string; sort?: string; category?: string }>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);

  const q = (resolvedSearchParams.q ?? "").trim();
  const page = toInt(resolvedSearchParams.page ?? "1", 1);
  const category = (resolvedSearchParams.category ?? "all").trim();

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
  if (category && category !== "all") {
    where.category = { slug: category };
  }

  const [allProducts, selectedCategory] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    category && category !== "all"
      ? prisma.category.findUnique({
          where: { slug: category },
          select: { name: true },
        })
      : null,
  ]);

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
  const baseParams = { q, availability, sort, category };
  const breadcrumbItems = ["Inicio", "Productos"];
  if (selectedCategory?.name) breadcrumbItems.push(selectedCategory.name);
  if (q) breadcrumbItems.push(q);

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <nav className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-1 text-base leading-6 text-black">
          {breadcrumbItems.map((item, index) => (
            <span key={`${item}-${index}`} className="flex items-center gap-4">
              {index === 0 ? (
                <Link href="/" className="hover:text-zinc-600">
                  {item}
                </Link>
              ) : index === 1 ? (
                <Link href="/products" className="hover:text-zinc-600">
                  {item}
                </Link>
              ) : (
                <span>{item}</span>
              )}
              {index < breadcrumbItems.length - 1 && <span>/</span>}
            </span>
          ))}
        </nav>

        <div className="mb-7 flex items-center justify-between gap-4">
          <ProductSortSelect value={sort} />
          <div className="hidden text-xs text-zinc-500 sm:block">
            {total} resultado{total === 1 ? "" : "s"}
          </div>
        </div>

        {products.length === 0 ? (
          <div className="border border-zinc-200 bg-white p-8">
            <p className="text-zinc-600">No hay productos con esos filtros.</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => {
                const img =
                  p.images[0]?.url ?? "https://placehold.co/900x900/png?text=Fika";
                const isOos = p.stock <= 0;
                const basePrice = p.price;
                const promoPercent = promoMap.get(p.id) ?? 0;
                const finalPrice =
                  promoPercent > 0 ? Math.round(basePrice * (1 - promoPercent / 100) * 100) / 100 : basePrice;

                return (
                  <Link key={p.id} href={`/products/${p.slug}`} className="group block min-w-0 text-center">
                    <div className="relative aspect-square w-full overflow-hidden bg-zinc-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img}
                        alt={p.name}
                        className={[
                          "h-full w-full object-cover transition duration-300",
                          isOos ? "opacity-60" : "group-hover:scale-[1.02]",
                        ].join(" ")}
                      />

                      {isOos && (
                        <span className="absolute left-2 top-2 bg-white/90 px-2 py-1 text-[11px] uppercase text-zinc-700">
                          Sin stock
                        </span>
                      )}
                    </div>

                    <div className="mt-2 min-w-0">
                      <h2 className="truncate text-sm font-normal leading-5 text-black">{p.name}</h2>
                      {promoPercent > 0 && (
                        <div className="text-xs leading-4 text-zinc-500 line-through">{money(basePrice)}</div>
                      )}
                      <div className="text-base font-normal leading-6 text-black">{money(finalPrice)}</div>
                      <p className="mx-auto max-w-[11rem] text-xs leading-5 text-zinc-500">
                        3 cuotas sin interes de {money(finalPrice / 3)}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </section>

            {/* Paginación */}
            <div className="mt-10 flex items-center justify-between gap-3">
              <Link
                className={[
                  "border border-zinc-300 px-4 py-2 text-sm text-black hover:bg-zinc-50",
                  page <= 1 ? "pointer-events-none opacity-50" : "",
                ].join(" ")}
                href={buildHref("/products", { ...baseParams, page: page - 1 })}
              >
                ← Anterior
              </Link>

              <div className="text-sm text-zinc-500">
                Pagina <span className="text-black">{page}</span> / {totalPages}
              </div>

              <Link
                className={[
                  "border border-zinc-300 px-4 py-2 text-sm text-black hover:bg-zinc-50",
                  page >= totalPages ? "pointer-events-none opacity-50" : "",
                ].join(" ")}
                href={buildHref("/products", { ...baseParams, page: page + 1 })}
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
