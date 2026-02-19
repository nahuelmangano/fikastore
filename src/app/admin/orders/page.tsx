import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Params = {
  q?: string;
  status?: string;
  payment?: string;
  sort?: string;
};

function toOrderBy(sort: string): Prisma.OrderOrderByWithRelationInput {
  if (sort === "oldest") return { createdAt: "asc" };
  if (sort === "total_desc") return { total: "desc" };
  if (sort === "total_asc") return { total: "asc" };
  if (sort === "order_desc") return { orderNumber: "desc" };
  if (sort === "order_asc") return { orderNumber: "asc" };
  return { createdAt: "desc" };
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Params | Promise<Params>;
}) {
  const resolved = await Promise.resolve(searchParams);
  const q = (resolved.q ?? "").trim();
  const status = (resolved.status ?? "all").toLowerCase();
  const payment = (resolved.payment ?? "all").toLowerCase();
  const sort = (resolved.sort ?? "newest").toLowerCase();

  const and: Prisma.OrderWhereInput[] = [];

  if (q) {
    const maybeNumber = Number(q);
    and.push({
      OR: [
        { id: { contains: q } },
        { user: { email: { contains: q } } },
        ...(Number.isFinite(maybeNumber) ? [{ orderNumber: Math.floor(maybeNumber) }] : []),
      ],
    });
  }

  if (status !== "all") and.push({ status });
  if (payment !== "all") and.push({ payments: { some: { status: payment } } });

  const where: Prisma.OrderWhereInput = and.length > 0 ? { AND: and } : {};

  const orders = await prisma.order.findMany({
    where,
    orderBy: toOrderBy(sort),
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · Pedidos</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {orders.length} resultado{orders.length === 1 ? "" : "s"}
            </p>
          </div>
          <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver
          </Link>
        </div>

        <form className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              <label className="text-xs text-zinc-400">Buscar</label>
              <input
                name="q"
                defaultValue={q}
                placeholder="Email, #orden o id…"
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-3">
              <label className="text-xs text-zinc-400">Estado orden</label>
              <select
                name="status"
                defaultValue={status}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="pending_payment">Pending payment</option>
                <option value="paid">Paid</option>
                <option value="shipped">Shipped</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-zinc-400">Estado pago</label>
              <select
                name="payment"
                defaultValue={payment}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="all">Todos</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
                <option value="refunded">Refunded</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-zinc-400">Orden</label>
              <select
                name="sort"
                defaultValue={sort}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="newest">Más nuevos</option>
                <option value="oldest">Más viejos</option>
                <option value="total_desc">Total ↓</option>
                <option value="total_asc">Total ↑</option>
                <option value="order_desc">N° orden ↓</option>
                <option value="order_asc">N° orden ↑</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
              Aplicar
            </button>
            <Link
              href="/admin/orders"
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              Limpiar
            </Link>
          </div>
        </form>

        <div className="mt-8 space-y-4">
          {orders.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 text-sm text-zinc-400">
              No hay pedidos con esos filtros.
            </div>
          )}
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
