import Link from "next/link";
import { prisma } from "@/lib/prisma";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Admin · Productos</h1>
          <Link
  href="/admin/products/new"
  className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
>
  + Nuevo
</Link>

          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver a la tienda
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {products.map((p) => {
            const img = p.images[0]?.url ?? "https://placehold.co/300x300/png?text=Fika";
            return (
              <div
                key={p.id}
                className="flex flex-col gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} alt={p.name} className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="mt-1 text-xs text-zinc-500 font-mono">{p.slug}</div>
                  </div>
                </div>

                <div className="flex-1" />

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-center">
                  <div className="text-sm">
                    <div className="text-zinc-400">Precio</div>
                    <div className="font-semibold">{money(Number(p.price))}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-zinc-400">Stock</div>
                    <div className="font-semibold">{p.stock}</div>
                  </div>
                  <div className="text-sm">
                    <div className="text-zinc-400">Activo</div>
                    <div className="font-semibold">{p.isActive ? "Sí" : "No"}</div>
                  </div>
                </div>

                <div className="sm:ml-4">
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="inline-flex w-full justify-center rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60 sm:w-auto"
                  >
                    Editar
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
