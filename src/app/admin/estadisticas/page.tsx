import Link from "next/link";
import { prisma } from "@/lib/prisma";

const SALES_STATUSES = ["paid", "shipped"] as const;

export default async function AdminEstadisticasPage() {
  const [salesOrders, lowStockProducts] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...SALES_STATUSES] } },
      select: {
        id: true,
        total: true,
        items: {
          select: {
            nameSnapshot: true,
            quantity: true,
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { stock: { lt: 5 } },
      orderBy: [{ stock: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        stock: true,
        isActive: true,
      },
      take: 20,
    }),
  ]);

  const totalRevenue = salesOrders.reduce((acc, o) => acc + Number(o.total), 0);
  const salesCount = salesOrders.length;
  const ticketPromedio = salesCount > 0 ? totalRevenue / salesCount : 0;

  const productSales = new Map<string, { name: string; units: number }>();
  for (const order of salesOrders) {
    for (const item of order.items) {
      const key = item.nameSnapshot.trim().toLowerCase();
      const prev = productSales.get(key);
      productSales.set(key, {
        name: item.nameSnapshot,
        units: (prev?.units ?? 0) + item.quantity,
      });
    }
  }

  const topProduct = [...productSales.values()].sort((a, b) => b.units - a.units)[0] ?? null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · Estadísticas</h1>
            <p className="mt-1 text-sm text-zinc-400">Resumen comercial basado en pedidos pagados/enviados.</p>
          </div>

          <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver
          </Link>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
            <div className="text-xs text-zinc-400">Producto más vendido</div>
            <div className="mt-2 text-lg font-semibold">{topProduct?.name ?? "Sin ventas"}</div>
            <div className="mt-1 text-sm text-zinc-300">
              {topProduct ? `${topProduct.units} unidades` : "No hay datos suficientes."}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
            <div className="text-xs text-zinc-400">Ticket promedio</div>
            <div className="mt-2 text-lg font-semibold">${ticketPromedio.toLocaleString("es-AR")}</div>
            <div className="mt-1 text-sm text-zinc-300">{salesCount} pedido(s) considerados</div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
            <div className="text-xs text-zinc-400">Productos con stock bajo</div>
            <div className="mt-2 text-lg font-semibold">{lowStockProducts.length}</div>
            <div className="mt-1 text-sm text-zinc-300">Umbral: menos de 5 unidades</div>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Alertas de stock (&lt; 5)</h2>
          <div className="mt-4 overflow-hidden rounded-2xl border border-zinc-800">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-900/40">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Stock</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-950/20">
                  {lowStockProducts.map((p) => (
                    <tr key={p.id} className="text-sm">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.name}</div>
                        <div className="mt-0.5 font-mono text-xs text-zinc-500">/products/{p.slug}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={[
                              "inline-flex min-w-8 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold",
                              p.stock <= 0
                                ? "border-rose-700/40 bg-rose-100 text-rose-800"
                                : "border-amber-700/40 bg-amber-100 text-amber-800",
                            ].join(" ")}
                          >
                            {p.stock}
                          </span>
                          {p.stock <= 0 && (
                            <span className="text-xs font-medium text-rose-700">Sin stock</span>
                          )}
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
                  ))}
                  {lowStockProducts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-400">
                        No hay productos con stock bajo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
