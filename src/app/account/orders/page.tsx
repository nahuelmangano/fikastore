import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

function formatMoney(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) redirect("/login?next=/account/orders");

  const orders = await prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      items: { take: 3 },
      payments: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Mis pedidos</h1>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver a la tienda
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
            <p className="text-zinc-300">Todavía no tenés pedidos.</p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
            >
              Ver productos
            </Link>
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {orders.map((o) => {
              const lastPayment = o.payments[0];
              return (
                <Link
                  key={o.id}
                  href={`/account/orders/${o.id}`}
                  className="block rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 hover:bg-zinc-900/50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm text-zinc-400">
                        Pedido{" "}
                        <span className="font-mono text-zinc-300">#{o.orderNumber}</span>{" "}
                        <span className="text-zinc-500">({o.id.slice(0, 10)}…)</span>
                      </div>
                      <div className="mt-1 text-lg font-semibold">
                        {formatMoney(Number(o.total))}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {new Date(o.createdAt).toLocaleString("es-AR")}
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge label={`Orden: ${o.status}`} />
                      <div className="mt-2 text-xs text-zinc-400">
                        Pago: {lastPayment?.status ?? "—"}
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
        )}
      </div>
    </main>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-200">
      {label}
    </span>
  );
}
