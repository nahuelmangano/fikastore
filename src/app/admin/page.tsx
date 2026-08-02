import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgePercent,
  BarChart3,
  CheckCircle2,
  Mail,
  Package,
  Plus,
  ShoppingBag,
  Store,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import { getMailingSettings } from "@/lib/storeSettings";

type ActivityItem = {
  id: string;
  date: Date;
  title: string;
  description: string;
};

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function endOfToday() {
  const start = startOfToday();
  return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
}

function relativeTime(date: Date) {
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  if (minutes < 1) return "Hace instantes";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Ayer";
  return `Hace ${days} dias`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending_payment: "Pendiente",
    paid: "Pagado",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
    refunded: "Reintegrado",
  };
  return labels[status] || status;
}

export default async function AdminDashboardPage() {
  const session = await auth();
  const user = session?.user as { name?: string | null; email?: string | null; role?: string | null } | undefined;
  const isAdmin = isAdminRole(user?.role);
  const displayName = user?.name?.trim() || "";
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [
    todaySales,
    totalOrders,
    pendingOrders,
    customerCount,
    activeProducts,
    outOfStockProducts,
    categoryCount,
    activePromotions,
    promotionsEndingToday,
    latestOrders,
    latestCustomers,
    latestProducts,
    latestPromotions,
    mailing,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        status: { in: ["paid", "shipped", "delivered"] },
        createdAt: { gte: todayStart, lt: todayEnd },
      },
      _sum: { total: true },
    }),
    prisma.order.count(),
    prisma.order.count({ where: { status: { in: ["pending_payment", "paid"] } } }),
    prisma.user.count({ where: { role: "customer" } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.count({ where: { stock: { lte: 0 } } }),
    prisma.category.count(),
    prisma.promotion.count({ where: { isActive: true } }),
    prisma.promotion.count({
      where: {
        isActive: true,
        endsAt: { gte: todayStart, lt: todayEnd },
      },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        user: { select: { email: true, name: true } },
        items: { take: 2 },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    prisma.user.findMany({
      where: { role: "customer" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, email: true, name: true, createdAt: true },
    }),
    prisma.product.findMany({
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, name: true, updatedAt: true, stock: true },
    }),
    prisma.promotion.findMany({
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, name: true, updatedAt: true, isActive: true },
    }),
    getMailingSettings(),
  ]);

  const salesToday = Number(todaySales._sum.total ?? 0);
  const conversionLabel = totalOrders > 0 && customerCount > 0
    ? `${Math.round((totalOrders / customerCount) * 100)}%`
    : "Próximamente";

  const alerts = [
    pendingOrders > 0 ? `${pendingOrders} pedido${pendingOrders === 1 ? "" : "s"} pendiente${pendingOrders === 1 ? "" : "s"}` : null,
    outOfStockProducts > 0 ? `${outOfStockProducts} producto${outOfStockProducts === 1 ? "" : "s"} sin stock` : null,
    promotionsEndingToday > 0 ? `${promotionsEndingToday} promocion${promotionsEndingToday === 1 ? "" : "es"} vence${promotionsEndingToday === 1 ? "" : "n"} hoy` : null,
    isAdmin && mailing.smtpSource === "none" ? "Mailing sin configurar" : null,
  ].filter((item): item is string => Boolean(item));

  const activity = [
    ...latestOrders.map<ActivityItem>((order) => ({
      id: `order-${order.id}`,
      date: order.createdAt,
      title: `Pedido #${order.orderNumber} recibido`,
      description: order.user?.email || "Cliente sin email",
    })),
    ...latestCustomers.map<ActivityItem>((customer) => ({
      id: `customer-${customer.id}`,
      date: customer.createdAt,
      title: "Cliente registrado",
      description: customer.name || customer.email,
    })),
    ...latestProducts.map<ActivityItem>((product) => ({
      id: `product-${product.id}`,
      date: product.updatedAt,
      title: "Producto actualizado",
      description: `${product.name} · Stock ${product.stock}`,
    })),
    ...latestPromotions.map<ActivityItem>((promotion) => ({
      id: `promotion-${promotion.id}`,
      date: promotion.updatedAt,
      title: promotion.isActive ? "Promocion activa" : "Promocion actualizada",
      description: promotion.name,
    })),
  ]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 5);

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#70471F]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#A37A55]">Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#5F3B18]">
              {displayName ? `Hola, ${displayName} 👋` : "Hola 👋"}
            </h1>
            <p className="mt-2 text-base text-[#8F6A49]">Así está funcionando tu tienda hoy.</p>
          </div>
          <div className="rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#8B5A2B] shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#B18B68]">Última actualización</div>
            <div className="mt-1 font-semibold">Actualizado ahora</div>
          </div>
        </header>

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={BarChart3} title="Ventas hoy" value={money(salesToday)} subtitle="Total vendido hoy" featured />
          <KpiCard icon={Package} title="Pedidos" value={String(totalOrders)} subtitle={`${pendingOrders} pendiente${pendingOrders === 1 ? "" : "s"}`} />
          <KpiCard icon={Users} title="Clientes" value={String(customerCount)} subtitle="Clientes registrados" />
          <KpiCard icon={BarChart3} title="Conversión" value={conversionLabel} subtitle="Ventas sobre clientes" />
        </section>

        <section className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <Panel title="Acciones rápidas" subtitle="Atajos para operar la tienda.">
            <div className="grid gap-3 sm:grid-cols-2">
              <QuickAction href="/admin/products/new" icon={Plus} label="Nuevo producto" />
              <QuickAction href="/admin/promociones" icon={BadgePercent} label="Nueva promoción" />
              <QuickAction href="/admin/orders" icon={Package} label="Ver pedidos" />
              {isAdmin ? <QuickAction href="/admin/mailing" icon={Mail} label="Enviar mailing" /> : null}
              <QuickAction href="/" icon={Store} label="Ver tienda" newTab />
            </div>
          </Panel>

          <Panel title="Requiere atención" subtitle="Alertas operativas importantes.">
            {alerts.length > 0 ? (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div key={alert} className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 xl:py-2.5 text-sm text-amber-900">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{alert}</span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={CheckCircle2} title="No hay alertas por el momento." description="Todo está funcionando correctamente." />
            )}
          </Panel>
        </section>

        <section className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel title="Estado del catálogo" subtitle="Resumen de productos y promociones.">
            <div className="grid gap-3 sm:grid-cols-2">
              <CatalogMetric label="Productos activos" value={activeProducts} />
              <CatalogMetric label="Productos sin stock" value={outOfStockProducts} attention={outOfStockProducts > 0} />
              <CatalogMetric label="Categorías" value={categoryCount} />
              <CatalogMetric label="Promociones activas" value={activePromotions} />
            </div>
          </Panel>

          <Panel title="Actividad reciente" subtitle="Últimos movimientos de la tienda.">
            {activity.length > 0 ? (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div key={item.id} className="relative border-l border-[#E5D7C8] pl-5">
                    <span className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border-2 border-white bg-[#8B5A2B]" />
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#B18B68]">{relativeTime(item.date)}</div>
                    <div className="mt-1 text-sm font-semibold text-[#5F3B18]">{item.title}</div>
                    <div className="mt-0.5 text-sm text-[#8F6A49]">{item.description}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={Tags} title="Todavía no hay actividad reciente." description="Los movimientos de la tienda van a aparecer acá." />
            )}
          </Panel>
        </section>

        <section className="mt-8 xl:mt-6">
          <Panel
            title={latestOrders.length > 0 ? "Últimos pedidos" : "Últimos clientes"}
            subtitle={latestOrders.length > 0 ? "Pedidos más recientes de la tienda." : "Todavía no hay pedidos; mostramos clientes recientes."}
            action={<Link href={latestOrders.length > 0 ? "/admin/orders" : "/admin/users"} className="inline-flex items-center gap-1 text-sm font-semibold text-[#8B5A2B] hover:text-[#70471F]">Ver todos <ArrowRight className="h-4 w-4" /></Link>}
          >
            {latestOrders.length > 0 ? (
              <div className="overflow-hidden rounded-2xl border border-[#E5D7C8]">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                    <thead className="bg-[#F6F0EA] text-xs font-semibold uppercase tracking-wide text-[#A37A55]">
                      <tr>
                        <th className="px-4 py-3 xl:py-2.5">Pedido</th>
                        <th className="px-4 py-3 xl:py-2.5">Cliente</th>
                        <th className="px-4 py-3 xl:py-2.5">Estado</th>
                        <th className="px-4 py-3 xl:py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5D7C8] bg-white/45">
                      {latestOrders.map((order) => (
                        <tr key={order.id} className="text-sm transition duration-150 hover:bg-[#F2ECE5]">
                          <td className="px-4 py-4 xl:py-2.5">
                            <Link href={`/admin/orders/${order.id}`} className="font-semibold text-[#5F3B18] hover:text-[#8B5A2B]">
                              #{order.orderNumber}
                            </Link>
                            <div className="mt-1 text-xs text-[#A37A55]">{relativeTime(order.createdAt)}</div>
                          </td>
                          <td className="px-4 py-4 xl:py-2.5">
                            <div className="font-medium text-[#70471F]">{order.user?.name || "Sin nombre"}</div>
                            <div className="mt-1 text-xs text-[#A37A55]">{order.user?.email || "Sin email"}</div>
                          </td>
                          <td className="px-4 py-4 xl:py-2.5">
                            <span className="inline-flex rounded-full border border-[#E5D7C8] bg-[#FAF8F5] px-2.5 py-1 text-xs font-semibold text-[#7B522E]">
                              {statusLabel(order.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4 xl:py-2.5 text-right font-semibold text-[#5F3B18]">{money(Number(order.total))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : latestCustomers.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {latestCustomers.map((customer) => (
                  <div key={customer.id} className="rounded-2xl border border-[#E5D7C8] bg-white/45 p-4">
                    <div className="font-semibold text-[#5F3B18]">{customer.name || "Sin nombre"}</div>
                    <div className="mt-1 text-sm text-[#8F6A49]">{customer.email}</div>
                    <div className="mt-3 text-xs font-medium text-[#B18B68]">{relativeTime(customer.createdAt)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={ShoppingBag} title="Todavía no tenés pedidos." description="Creá tu primer producto para comenzar." />
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function KpiCard({
  icon: Icon,
  title,
  value,
  subtitle,
  featured = false,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  subtitle: string;
  featured?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-3xl border p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.06)]",
        featured
          ? "border-[#8B5A2B] bg-[#8B5A2B] text-white"
          : "border-[#E5D7C8] bg-white/70 text-[#70471F]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={featured ? "text-sm font-medium text-white/75" : "text-sm font-medium text-[#A37A55]"}>{title}</div>
          <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
          <div className={featured ? "mt-2 text-sm text-white/75" : "mt-2 text-sm text-[#8F6A49]"}>{subtitle}</div>
        </div>
        <div className={featured ? "rounded-2xl bg-white/15 p-3" : "rounded-2xl bg-[#F2ECE5] p-3 text-[#8B5A2B]"}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#5F3B18]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[#8F6A49]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  newTab = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  newTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      rel={newTab ? "noopener noreferrer" : undefined}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-4 xl:py-2.5 text-sm font-semibold text-[#70471F] transition duration-150 hover:translate-x-1 hover:bg-[#F2ECE5]"
    >
      <span className="flex items-center gap-3">
        <span className="rounded-xl bg-white p-2 text-[#8B5A2B] shadow-sm">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {label}
      </span>
      <ArrowRight className="h-4 w-4 text-[#B18B68] transition duration-150 group-hover:text-[#8B5A2B]" aria-hidden="true" />
    </Link>
  );
}

function CatalogMetric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) {
  return (
    <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
      <div className="text-sm text-[#8F6A49]">{label}</div>
      <div className={["mt-2 text-2xl font-semibold", attention ? "text-amber-700" : "text-[#5F3B18]"].join(" ")}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E5D7C8] bg-[#FAF8F5]/70 px-5 py-8 xl:py-6 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#8B5A2B] shadow-sm">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="mt-4 font-semibold text-[#5F3B18]">{title}</div>
      <p className="mx-auto mt-1 max-w-sm text-sm text-[#8F6A49]">{description}</p>
    </div>
  );
}
