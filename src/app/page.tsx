import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CartLink from "@/components/CartLink";

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string; availability?: string; sort?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const page = toInt(searchParams.page ?? "1", 1);

  // availability: available | all | oos
  const availability = (searchParams.availability ?? "available").toLowerCase();
  // sort: newest | price_asc | price_desc | stock_desc
  const sort = (searchParams.sort ?? "newest").toLowerCase();

  const where: any = { isActive: true };

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { slug: { contains: q } },
      { description: { contains: q } },
    ];
  }

  if (availability === "available") {
    where.stock = { gt: 0 };
  } else if (availability === "oos") {
    where.stock = 0;
  } // all => no stock filter

  const orderBy: any =
    sort === "price_asc"
      ? { price: "asc" }
      : sort === "price_desc"
      ? { price: "desc" }
      : sort === "stock_desc"
      ? { stock: "desc" }
      : { createdAt: "desc" };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const baseParams = { q, availability, sort };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <header className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div />
            <CartLink />
          </div>

          <h1 className="text-3xl font-semibold tracking-tight">Fika Store</h1>
          <p className="mt-2 text-zinc-400">
            Pijamas pant, remerones y ropa cómoda para estar en casa ✨
          </p>

          {/* Filtros */}
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
        </header>

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
                          {p.description ?? "Producto Fika"}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-base font-semibold">
                          ${Number(p.price).toLocaleString("es-AR")}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Stock: {p.stock}
                        </div>
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
