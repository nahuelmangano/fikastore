import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CartLink from "@/components/CartLink";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

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
        </header>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
            <p className="text-zinc-300">No hay productos publicados todavía.</p>
          </div>
        ) : (
          <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const img =
                p.images[0]?.url ?? "https://placehold.co/900x900/png?text=Fika";

              return (
                <Link
                  key={p.id}
                  href={`/products/${p.slug}`}
                  className="group rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4 transition hover:border-zinc-700 hover:bg-zinc-900/50"
                >
                  <div className="aspect-square overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt={p.name}
                      className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                    />
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-medium">{p.name}</h2>
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
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
