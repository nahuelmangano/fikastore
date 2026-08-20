import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CreditCard } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCategoryAndDescendantIds } from "@/lib/categories";
import ProductSortSelect from "@/components/ProductSortSelect";
import { getAutomaticDiscountsForProducts } from "@/lib/promotions";
import StoreTemporarilyClosed from "@/components/StoreTemporarilyClosed";
import { getTemporaryShutdownSettings } from "@/lib/storeSettings";

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

function moneyNoCents(value: number) {
  return value.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

type ListedProduct = Prisma.ProductGetPayload<{
  include: { images: { where: { visible: true }; orderBy: { sortOrder: "asc" }; take: 1 } };
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
  const temporaryShutdown = await getTemporaryShutdownSettings();

  if (temporaryShutdown.isShutdown) {
    return <StoreTemporarilyClosed message={temporaryShutdown.message} />;
  }

  // availability: available | all | oos
  const availability = (resolvedSearchParams.availability ?? "all").toLowerCase();
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
    const categoryIds = await getCategoryAndDescendantIds(category);
    where.categoryId = categoryIds.length > 0 ? { in: categoryIds } : "__missing__";
  }

  const [allProducts, selectedCategory] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { images: { where: { visible: true }, orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
    category && category !== "all"
      ? prisma.category.findUnique({
          where: { slug: category },
          select: { name: true },
        })
      : null,
  ]);
  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, parentId: true, name: true, slug: true },
  });
  const selectedSidebarCategory = category && category !== "all" ? categories.find((item) => item.slug === category) : null;
  const childrenByParent = new Map<string, typeof categories>();

  for (const item of categories) {
    if (!item.parentId) continue;
    childrenByParent.set(item.parentId, [...(childrenByParent.get(item.parentId) ?? []), item]);
  }

  const sidebarItems = selectedSidebarCategory ? childrenByParent.get(selectedSidebarCategory.id) ?? [] : [];

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
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
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

        <div className={["grid gap-8", sidebarItems.length > 0 ? "lg:grid-cols-[210px_minmax(0,1fr)]" : ""].join(" ")}>
          {sidebarItems.length > 0 ? (
            <aside className="hidden lg:block">
              <h1 className="text-2xl font-normal leading-8 text-black">{selectedSidebarCategory?.name}</h1>
              <nav className="mt-5 space-y-1 text-base leading-6 text-black">
                {sidebarItems.map((item) => (
                  <Link
                    key={item.id}
                    href={buildHref("/products", { q, availability, sort, category: item.slug })}
                    className="block font-normal hover:text-zinc-600"
                  >
                    {item.name}
                  </Link>
                ))}
              </nav>
            </aside>
          ) : null}

          <div className="min-w-0">
            {products.length === 0 ? (
              <div className="border border-zinc-200 bg-white p-8">
                <p className="text-zinc-600">No hay productos con esos filtros.</p>
              </div>
            ) : (
              <>
                <section className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                  {products.map((p) => {
                    const img =
                      p.images[0]?.url ?? "https://placehold.co/900x900/png?text=Fika";
                    const isOos = p.stock <= 0;
                    const basePrice = p.price;
                    const promoPercent = promoMap.get(p.id) ?? 0;
                    const finalPrice =
                      promoPercent > 0 ? Math.round(basePrice * (1 - promoPercent / 100) * 100) / 100 : basePrice;

                    return (
                      <Link
                        key={p.id}
                        href={`/products/${p.slug}`}
                        className="group block min-w-0 overflow-hidden rounded-md border border-zinc-200 bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                      >
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
                            <span className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-[11px] uppercase text-zinc-700 shadow-sm">
                              Sin stock
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 px-3 pb-3 pt-3">
                          <h2 className="truncate text-sm font-semibold leading-5 text-zinc-900">{p.name}</h2>

                          <div className="mt-3 text-xl font-semibold leading-6 text-zinc-950">
                            {moneyNoCents(basePrice)}
                          </div>

                          {promoPercent > 0 ? (
                            <>
                              <p className="mt-1 truncate text-[11px] leading-4 text-zinc-700">
                                {promoPercent}% OFF con transferencia o efectivo
                              </p>
                              <p className="mt-1 text-sm font-semibold leading-5 text-[#8B551F]">
                                {moneyNoCents(finalPrice)}
                              </p>
                            </>
                          ) : null}

                          <div className="mt-4 border-t border-zinc-200 pt-3">
                            <div className="flex items-center gap-2 text-[11px] leading-4 text-[#8B6A52]">
                              <CreditCard className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              <span>
                                3 cuotas sin interés de{" "}
                                <span className="font-semibold text-[#6F533D]">{moneyNoCents(finalPrice / 3)}</span>
                              </span>
                            </div>
                          </div>
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
        </div>
      </div>
    </main>
  );
}
