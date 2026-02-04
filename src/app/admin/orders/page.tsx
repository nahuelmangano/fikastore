import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminOrdersPage() {
  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      items: { take: 3 },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
      user: { select: { email: true } },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Admin · Pedidos</h1>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver a la tienda
          </Link>
        </div>

        <div className="mt-8 space-y-4">
          {orders.map((o) => {
            const lastPayment = o.payments[0];
            return (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="block rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 hover:bg-zinc-900/50"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-500 font-mono">
                      #{o.orderNumber} · {o.id}
                    </div>
                    <div className="mt-1 text-sm text-zinc-300">{o.user?.email}</div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(o.createdAt).toLocaleString("es-AR")}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm text-zinc-300">Orden: <b>{o.status}</b></div>
                    <div className="text-xs text-zinc-400">Pago: {lastPayment?.status ?? "—"}</div>
                    <div className="mt-1 text-sm font-semibold">
                      ${Number(o.total).toLocaleString("es-AR")}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-sm text-zinc-300">
                  {o.items.map((it) => it.nameSnapshot).join(" · ")}
                  {o.items.length > 3 ? "…" : ""}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
