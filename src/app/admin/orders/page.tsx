import Link from "next/link";
import { CalendarClock, CreditCard, PackageCheck, ShoppingBag } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import PageToolbar from "@/components/admin/layout/PageToolbar";
import SectionCard from "@/components/admin/cards/SectionCard";
import StatCard from "@/components/admin/cards/StatCard";
import DataTable, { type DataTableColumn } from "@/components/admin/data/DataTable";
import EmptyState from "@/components/admin/data/EmptyState";
import StatusBadge from "@/components/admin/data/StatusBadge";
import OrderQuickFilters from "./OrderQuickFilters";
import OrderSearchField from "./OrderSearchField";

const PAGE_SIZE = 20;

type Params = {
  q?: string;
  status?: string;
  payment?: string;
  sort?: string;
  page?: string;
};

type ListedOrder = {
  id: string;
  orderNumber: number;
  status: string;
  total: number;
  createdAt: Date;
  shippedAt: Date | null;
  shippingMethod: string | null;
  user: { name: string | null; email: string | null } | null;
  items: Array<{ id: string; nameSnapshot: string; quantity: number }>;
  payments: Array<{ status: string; paymentId: string | null }>;
  epickShipment: { status: string } | null;
  correoShipment: { status: string } | null;
};

function toInt(value: string | null, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function toOrderBy(sort: string): Prisma.OrderOrderByWithRelationInput {
  if (sort === "oldest") return { createdAt: "asc" };
  if (sort === "total_desc") return { total: "desc" };
  if (sort === "total_asc") return { total: "asc" };
  if (sort === "order_desc") return { orderNumber: "desc" };
  if (sort === "order_asc") return { orderNumber: "asc" };
  return { createdAt: "desc" };
}

function buildHref(base: string, params: Record<string, string | number | null | undefined>) {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const stringValue = String(value).trim();
    if (!stringValue || stringValue === "all") continue;
    sp.set(key, stringValue);
  }
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: Date) {
  const date = new Date(value);
  const day = date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return { day, time };
}

function orderStatus(status: string) {
  const map: Record<string, { label: string; variant: "neutral" | "success" | "warning" | "danger" | "info" }> = {
    pending_payment: { label: "Pendiente", variant: "warning" },
    paid: { label: "Pagado", variant: "success" },
    shipped: { label: "Enviado", variant: "info" },
    cancelled: { label: "Cancelado", variant: "danger" },
    refunded: { label: "Reembolsado", variant: "neutral" },
  };
  return map[status] ?? { label: status, variant: "neutral" as const };
}

function paymentStatus(status?: string) {
  const map: Record<string, { label: string; variant: "neutral" | "success" | "warning" | "danger" | "info" }> = {
    pending: { label: "Pendiente", variant: "warning" },
    approved: { label: "Aprobado", variant: "success" },
    rejected: { label: "Rechazado", variant: "danger" },
    cancelled: { label: "Cancelado", variant: "danger" },
    refunded: { label: "Reembolsado", variant: "neutral" },
    unknown: { label: "Sin confirmar", variant: "neutral" },
  };
  if (!status) return { label: "Sin pago", variant: "neutral" as const };
  return map[status] ?? { label: status, variant: "neutral" as const };
}

function shippingStatus(order: ListedOrder) {
  if (order.shippedAt || order.status === "shipped") return { label: "Enviado", variant: "success" as const };
  if (order.correoShipment?.status) return { label: `Correo · ${translateCorreo(order.correoShipment.status)}`, variant: "info" as const };
  if (order.epickShipment?.status) return { label: `E-pick · ${translateEpick(order.epickShipment.status)}`, variant: "info" as const };
  if (order.status === "paid") return { label: "A preparar", variant: "warning" as const };
  return { label: "Pendiente", variant: "neutral" as const };
}

function translateCorreo(status: string) {
  const map: Record<string, string> = { IMPORTED: "Importado" };
  return map[status] ?? status;
}

function translateEpick(status: string) {
  const map: Record<string, string> = {
    PENDING: "Pendiente",
    PAYED: "Pagado",
    CONFIRMED: "Confirmado",
    COLLECTED: "Retirado",
    "DELIVERED-TO-SERVICE": "En distribución",
    DELIVERED: "Entregado",
    CANCELED: "Cancelado",
  };
  return map[status] ?? status;
}

function statusOptionLabel(status: string) {
  return orderStatus(status).label;
}

function paymentOptionLabel(status: string) {
  return paymentStatus(status).label;
}

export default async function AdminOrdersPage({ searchParams }: { searchParams: Params | Promise<Params> }) {
  const resolved = await Promise.resolve(searchParams);
  const q = (resolved.q ?? "").trim();
  const status = (resolved.status ?? "all").toLowerCase();
  const payment = (resolved.payment ?? "all").toLowerCase();
  const sort = (resolved.sort ?? "newest").toLowerCase();
  const page = toInt(resolved.page ?? "1", 1);

  const and: Prisma.OrderWhereInput[] = [];
  if (q) {
    const maybeNumber = Number(q);
    and.push({
      OR: [
        { id: { contains: q } },
        { user: { email: { contains: q } } },
        { user: { name: { contains: q } } },
        ...(Number.isFinite(maybeNumber) ? [{ orderNumber: Math.floor(maybeNumber) }] : []),
      ],
    });
  }
  if (status !== "all") and.push({ status });
  if (payment !== "all") and.push({ payments: { some: { status: payment } } });

  const where: Prisma.OrderWhereInput = and.length > 0 ? { AND: and } : {};
  const baseParams = { q, status, payment, sort };

  const [ordersRaw, filteredTotal, totalOrders, pendingOrders, paidOrders, revenue, statusGroups, paymentGroups] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: toOrderBy(sort),
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        shippedAt: true,
        shippingMethod: true,
        items: {
          take: 3,
          select: { id: true, nameSnapshot: true, quantity: true },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, paymentId: true },
        },
        user: { select: { name: true, email: true } },
        epickShipment: { select: { status: true } },
        correoShipment: { select: { status: true } },
      },
    }),
    prisma.order.count({ where }),
    prisma.order.count(),
    prisma.order.count({ where: { status: "pending_payment" } }),
    prisma.order.count({ where: { status: { in: ["paid", "shipped"] } } }),
    prisma.order.aggregate({
      where: { status: { in: ["paid", "shipped"] } },
      _sum: { total: true },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const orders: ListedOrder[] = ordersRaw.map((order) => ({
    ...order,
    total: Number(order.total),
  }));
  const totalPages = Math.max(1, Math.ceil(filteredTotal / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const activeStatusValues = statusGroups.map((item) => item.status);
  const activePaymentValues = paymentGroups.map((item) => item.status);
  const statusCounts = Object.fromEntries(statusGroups.map((item) => [item.status, item._count._all]));
  const paidRevenue = Number(revenue._sum.total ?? 0);

  const columns: DataTableColumn<ListedOrder>[] = [
    {
      key: "order",
      header: "Pedido",
      cell: (order) => (
        <div>
          <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[var(--admin-primary)] hover:underline">
            #{order.orderNumber}
          </Link>
          <div className="mt-1 max-w-32 truncate text-xs text-[var(--admin-muted)]" title={order.id}>
            {order.id}
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Cliente",
      cell: (order) => (
        <div>
          <div className="font-semibold text-[var(--admin-text)]">{order.user?.name || order.user?.email || "Sin cliente"}</div>
          {order.user?.name && order.user?.email ? <div className="mt-1 text-xs text-[var(--admin-muted)]">{order.user.email}</div> : null}
        </div>
      ),
    },
    {
      key: "date",
      header: "Fecha",
      cell: (order) => {
        const date = formatDate(order.createdAt);
        return (
          <div>
            <div className="font-medium text-[var(--admin-text-soft)]">{date.day}</div>
            <div className="mt-1 text-xs text-[var(--admin-muted)]">{date.time}</div>
          </div>
        );
      },
    },
    {
      key: "payment",
      header: "Pago",
      cell: (order) => {
        const statusInfo = paymentStatus(order.payments[0]?.status);
        return <StatusBadge label={statusInfo.label} variant={statusInfo.variant} />;
      },
    },
    {
      key: "orderStatus",
      header: "Estado pedido",
      cell: (order) => {
        const statusInfo = orderStatus(order.status);
        return <StatusBadge label={statusInfo.label} variant={statusInfo.variant} />;
      },
    },
    {
      key: "shipping",
      header: "Envío",
      cell: (order) => {
        const statusInfo = shippingStatus(order);
        return <StatusBadge label={statusInfo.label} variant={statusInfo.variant} />;
      },
    },
    {
      key: "total",
      header: "Total",
      cell: (order) => <span className="font-semibold text-[var(--admin-text)]">{money(order.total)}</span>,
    },
    {
      key: "actions",
      header: "Acciones",
      headerClassName: "text-right",
      className: "text-right",
      cell: (order) => (
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex rounded-xl border border-[var(--admin-border)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
        >
          Ver pedido
        </Link>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-[var(--admin-background)] text-[var(--admin-text-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <AdminPageHeader
          eyebrow="Admin · Operación"
          title="Pedidos"
          subtitle={`Gestioná las compras, pagos y envíos de tu tienda. ${totalOrders} pedido${totalOrders === 1 ? "" : "s"}.`}
          backHref="/admin"
        />

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Pedidos" value={totalOrders} description="Total histórico" icon={ShoppingBag} />
          <StatCard title="Pendientes" value={pendingOrders} description="Esperando pago" icon={CalendarClock} />
          <StatCard title="Pagados" value={paidOrders} description="Pagados o enviados" icon={PackageCheck} />
          <StatCard title="Facturación" value={money(paidRevenue)} description="Pedidos pagados/enviados" icon={CreditCard} />
        </section>

        <SectionCard className="mt-8 xl:mt-6">
          <PageToolbar
            title="Centro de pedidos"
            description={`${filteredTotal} resultado${filteredTotal === 1 ? "" : "s"} · Página ${currentPage} de ${totalPages}`}
            filters={
              <OrderQuickFilters
                currentStatus={status}
                counts={{
                  all: totalOrders,
                  pending_payment: statusCounts.pending_payment ?? 0,
                  paid: statusCounts.paid ?? 0,
                  shipped: statusCounts.shipped ?? 0,
                  cancelled: statusCounts.cancelled ?? 0,
                  refunded: statusCounts.refunded ?? 0,
                }}
                baseParams={baseParams}
              />
            }
          />

          <form className="mt-5">
            <input type="hidden" name="page" value="1" />
            <div className="grid gap-3 md:grid-cols-12">
              <div className="md:col-span-5">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Buscar</label>
                <div className="mt-2">
                  <OrderSearchField initialValue={q} />
                </div>
              </div>

              <div className="md:col-span-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Estado pedido</label>
                <select name="status" defaultValue={status} className="admin-input mt-2">
                  <option value="all">Todos</option>
                  {["pending_payment", "paid", "shipped", "cancelled", "refunded"]
                    .filter((value) => activeStatusValues.includes(value) || value === status)
                    .map((value) => (
                      <option key={value} value={value}>
                        {statusOptionLabel(value)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Estado pago</label>
                <select name="payment" defaultValue={payment} className="admin-input mt-2">
                  <option value="all">Todos</option>
                  {["pending", "approved", "rejected", "cancelled", "refunded", "unknown"]
                    .filter((value) => activePaymentValues.includes(value) || value === payment)
                    .map((value) => (
                      <option key={value} value={value}>
                        {paymentOptionLabel(value)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Orden</label>
                <select name="sort" defaultValue={sort} className="admin-input mt-2">
                  <option value="newest">Más nuevos</option>
                  <option value="oldest">Más viejos</option>
                  <option value="total_desc">Total ↓</option>
                  <option value="total_asc">Total ↑</option>
                  <option value="order_desc">N° orden ↓</option>
                  <option value="order_asc">N° orden ↑</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30">
                Aplicar filtros
              </button>
              <Link href="/admin/orders" className="rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]">
                Limpiar
              </Link>
            </div>
          </form>
        </SectionCard>

        <div className="mt-6 xl:mt-4 hidden md:block">
          {orders.length > 0 ? (
            <DataTable columns={columns} data={orders} rowKey={(order) => order.id} caption="Pedidos" />
          ) : (
            <OrdersEmptyState hasFilters={Boolean(q || status !== "all" || payment !== "all")} />
          )}
        </div>

        <div className="mt-6 xl:mt-4 space-y-3 md:hidden">
          {orders.length > 0 ? orders.map((order) => <OrderMobileCard key={order.id} order={order} />) : <OrdersEmptyState hasFilters={Boolean(q || status !== "all" || payment !== "all")} />}
        </div>

        {orders.length > 0 ? (
          <div className="mt-6 xl:mt-4 flex flex-col gap-3 rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow)] sm:flex-row sm:items-center sm:justify-between">
            <Link
              className={["rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]", currentPage <= 1 ? "pointer-events-none opacity-50" : ""].join(" ")}
              href={buildHref("/admin/orders", { ...baseParams, page: currentPage - 1 })}
            >
              Anterior
            </Link>
            <div className="text-sm text-[var(--admin-muted)]">
              Página <span className="font-semibold text-[var(--admin-text)]">{currentPage}</span> de {totalPages}
            </div>
            <Link
              className={["rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]", currentPage >= totalPages ? "pointer-events-none opacity-50" : ""].join(" ")}
              href={buildHref("/admin/orders", { ...baseParams, page: currentPage + 1 })}
            >
              Siguiente
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function OrdersEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <EmptyState
      icon={ShoppingBag}
      title={hasFilters ? "No encontramos pedidos." : "Todavía no recibiste pedidos."}
      description={hasFilters ? "Probá cambiar la búsqueda o limpiar los filtros." : "Cuando un cliente complete una compra aparecerá aquí."}
      action={
        hasFilters ? (
          <Link href="/admin/orders" className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)]">
            Limpiar filtros
          </Link>
        ) : (
          <Link href="/" className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)]">
            Ver tienda
          </Link>
        )
      }
    />
  );
}

function OrderMobileCard({ order }: { order: ListedOrder }) {
  const orderInfo = orderStatus(order.status);
  const paymentInfo = paymentStatus(order.payments[0]?.status);
  const shippingInfo = shippingStatus(order);
  const date = formatDate(order.createdAt);

  return (
    <article className="rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[var(--admin-primary)]">
            Pedido #{order.orderNumber}
          </Link>
          <div className="mt-1 text-sm text-[var(--admin-muted)]">{order.user?.name || order.user?.email || "Sin cliente"}</div>
          <div className="mt-1 text-xs text-[var(--admin-muted)]">
            {date.day} · {date.time}
          </div>
        </div>
        <div className="text-right font-semibold text-[var(--admin-text)]">{money(order.total)}</div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge label={paymentInfo.label} variant={paymentInfo.variant} />
        <StatusBadge label={orderInfo.label} variant={orderInfo.variant} />
        <StatusBadge label={shippingInfo.label} variant={shippingInfo.variant} />
      </div>
      <Link
        href={`/admin/orders/${order.id}`}
        className="mt-4 inline-flex rounded-xl border border-[var(--admin-border)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
      >
        Ver pedido
      </Link>
    </article>
  );
}
