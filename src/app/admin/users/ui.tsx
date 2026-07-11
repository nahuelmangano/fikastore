"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import PageToolbar from "@/components/admin/layout/PageToolbar";
import SectionCard from "@/components/admin/cards/SectionCard";
import StatCard from "@/components/admin/cards/StatCard";
import DataTable, { type DataTableColumn } from "@/components/admin/data/DataTable";
import EmptyState from "@/components/admin/data/EmptyState";
import FilterChips from "@/components/admin/data/FilterChips";
import SearchBar from "@/components/admin/data/SearchBar";
import StatusBadge from "@/components/admin/data/StatusBadge";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  orders: number;
  total: number;
  lastOrder: {
    id: string;
    orderNumber: number;
    total: number;
    status: string;
    createdAt: string;
  } | null;
};

type FilterKey = "all" | "with_orders" | "without_orders" | "new" | "frequent";

const filters: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "with_orders", label: "Con compras" },
  { key: "without_orders", label: "Sin compras" },
  { key: "new", label: "Nuevos" },
  { key: "frequent", label: "Clientes frecuentes" },
];

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isNewCustomer(user: UserRow) {
  const createdAt = new Date(user.createdAt).getTime();
  if (Number.isNaN(createdAt)) return false;
  return Date.now() - createdAt <= 1000 * 60 * 60 * 24 * 30;
}

function displayName(user: UserRow) {
  return user.name?.trim() || "Sin nombre";
}

function initials(user: UserRow) {
  const source = user.name?.trim() || user.email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function customerBadges(user: UserRow) {
  const badges: { label: string; variant: "neutral" | "success" | "warning" | "brand" | "purple" }[] = [];
  if (user.orders === 0) badges.push({ label: "Sin compras", variant: "neutral" });
  if (user.orders > 0) badges.push({ label: "Compró", variant: "success" });
  if (isNewCustomer(user)) badges.push({ label: "Cliente nuevo", variant: "warning" });
  if (user.orders >= 3) badges.push({ label: "Frecuente", variant: "brand" });
  if (user.total >= 100000) badges.push({ label: "VIP", variant: "purple" });
  return badges;
}

export default function AdminUsersCrm({ users, isAdmin }: { users: UserRow[]; isAdmin: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

  const customers = users.filter((user) => user.role === "customer");
  const usersWithOrders = customers.filter((user) => user.orders > 0);
  const totalRevenue = customers.reduce((sum, user) => sum + user.total, 0);
  const totalOrders = customers.reduce((sum, user) => sum + user.orders, 0);
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const filterOptions = useMemo(
    () => filters.map((item) => ({
      value: item.key,
      label: item.label,
      count:
        item.key === "all"
          ? users.length
          : item.key === "with_orders"
            ? users.filter((user) => user.orders > 0).length
            : item.key === "without_orders"
              ? users.filter((user) => user.orders === 0).length
              : item.key === "new"
                ? users.filter(isNewCustomer).length
                : users.filter((user) => user.orders >= 3).length,
    })),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !normalizedQuery || `${user.name || ""} ${user.email}`.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "with_orders" && user.orders > 0) ||
        (filter === "without_orders" && user.orders === 0) ||
        (filter === "new" && isNewCustomer(user)) ||
        (filter === "frequent" && user.orders >= 3);
      return matchesQuery && matchesFilter;
    });
  }, [filter, query, users]);

  const columns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      {
        key: "customer",
        header: "Cliente",
        cell: (user) => (
          <div className="flex items-center gap-3">
            <Avatar user={user} />
            <div>
              <div className="font-semibold text-[var(--admin-text)]">{displayName(user)}</div>
              <div className="mt-1 text-xs text-[var(--admin-muted-2)]">{roleLabel(user.role)}</div>
            </div>
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        cell: (user) => <span className="text-[var(--admin-text-soft)]">{user.email}</span>,
      },
      {
        key: "status",
        header: "Estado",
        cell: (user) => (
          <div className="flex max-w-52 flex-wrap gap-1.5">
            {customerBadges(user).map((badge) => (
              <StatusBadge key={badge.label} label={badge.label} variant={badge.variant} />
            ))}
          </div>
        ),
      },
      {
        key: "orders",
        header: "Pedidos",
        cell: (user) => <span className="font-semibold text-[var(--admin-text)]">{user.orders}</span>,
      },
      {
        key: "total",
        header: "Total gastado",
        cell: (user) => <span className="font-semibold text-[var(--admin-text)]">{money(user.total)}</span>,
      },
      {
        key: "lastOrder",
        header: "Última compra",
        cell: (user) => <span className="text-[var(--admin-muted)]">{user.lastOrder ? formatDate(user.lastOrder.createdAt) : "Sin compras"}</span>,
      },
      {
        key: "createdAt",
        header: "Alta",
        cell: (user) => <span className="text-[var(--admin-muted)]">{formatDate(user.createdAt)}</span>,
      },
      {
        key: "actions",
        header: "Acciones",
        headerClassName: "text-right",
        className: "text-right",
        cell: (user) => (
          <button
            type="button"
            onClick={() => setSelectedUser(user)}
            className="inline-flex items-center gap-1 rounded-xl border border-[var(--admin-border)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          >
            Ver
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ),
      },
    ],
    []
  );

  return (
    <main className="min-h-screen bg-[var(--admin-background)] text-[var(--admin-text-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <AdminPageHeader
          eyebrow="Admin · Clientes"
          title="Clientes"
          subtitle="Administrá los clientes registrados y conocé su actividad dentro de la tienda."
          backHref="/admin"
          actions={
            isAdmin ? (
              <Link
                href="/admin/users/new"
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[var(--admin-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              >
                Alta merchant
              </Link>
            ) : null
          }
        />

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Users} title="Clientes registrados" value={customers.length} description="Cuentas de clientes" variant="featured" />
          <StatCard icon={ShoppingBag} title="Clientes con compras" value={usersWithOrders.length} description="Compraron al menos una vez" />
          <StatCard icon={Wallet} title="Facturación total" value={money(totalRevenue)} description="Compras acumuladas" />
          <StatCard icon={Star} title="Ticket promedio" value={totalOrders > 0 ? money(averageTicket) : "0"} description="Promedio por pedido" />
        </section>

        <SectionCard className="mt-8 xl:mt-6">
          <PageToolbar
            title="Base de clientes"
            description={`${filteredUsers.length} resultado${filteredUsers.length === 1 ? "" : "s"} visible${filteredUsers.length === 1 ? "" : "s"}.`}
            search={
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Buscar por nombre o email..."
                ariaLabel="Buscar clientes por nombre o email"
              />
            }
            filters={
              <FilterChips
                options={filterOptions}
                value={filter}
                onChange={setFilter}
                ariaLabel="Filtrar clientes"
              />
            }
          />

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title={users.length === 0 ? "Todavía no hay clientes registrados." : "No encontramos clientes con esos filtros."}
              description={
                users.length === 0
                  ? "Cuando alguien realice una compra aparecerá aquí."
                  : "Probá cambiar la búsqueda o volver al filtro Todos."
              }
            />
          ) : (
            <>
              <div className="mt-5 hidden lg:block">
                <DataTable
                  columns={columns}
                  data={filteredUsers}
                  rowKey={(user) => user.id}
                  caption="Clientes registrados"
                />
              </div>

              <div className="mt-5 grid gap-3 lg:hidden">
                {filteredUsers.map((user) => (
                  <UserMobileCard key={user.id} user={user} onSelect={() => setSelectedUser(user)} />
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {selectedUser ? <CustomerDrawer user={selectedUser} onClose={() => setSelectedUser(null)} /> : null}
    </main>
  );
}

function UserMobileCard({ user, onSelect }: { user: UserRow; onSelect: () => void }) {
  return (
    <article className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
      <div className="flex items-start gap-3">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-[#5F3B18]">{displayName(user)}</div>
          <div className="mt-1 truncate text-sm text-[#8F6A49]">{user.email}</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {customerBadges(user).map((badge) => (
              <StatusBadge key={badge.label} label={badge.label} variant={badge.variant} />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <MiniMetric label="Pedidos" value={String(user.orders)} />
        <MiniMetric label="Total" value={money(user.total)} />
        <MiniMetric label="Última compra" value={user.lastOrder ? formatDate(user.lastOrder.createdAt) : "Sin compras"} />
        <MiniMetric label="Alta" value={formatDate(user.createdAt)} />
      </div>
      <button
        type="button"
        onClick={onSelect}
        className="mt-4 w-full rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]"
      >
        Ver cliente
      </button>
    </article>
  );
}

function Avatar({ user }: { user: UserRow }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#8B5A2B] text-sm font-bold text-white shadow-sm">
      {initials(user)}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E5D7C8] bg-white/55 p-3">
      <div className="text-xs text-[#A37A55]">{label}</div>
      <div className="mt-1 font-semibold text-[#5F3B18]">{value}</div>
    </div>
  );
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "merchant") return "Merchant";
  return "Cliente";
}

function CustomerDrawer({ user, onClose }: { user: UserRow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Cerrar panel" className="absolute inset-0 bg-black/25" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-[#FAF8F5] p-5 xl:p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar user={user} />
            <div>
              <h2 className="text-xl font-semibold text-[#5F3B18]">{displayName(user)}</h2>
              <p className="mt-1 text-sm text-[#8F6A49]">{user.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E5D7C8] p-2 text-[#8B5A2B] hover:bg-[#F2ECE5]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-6 xl:mt-4 flex flex-wrap gap-2">
          {customerBadges(user).map((badge) => (
            <StatusBadge key={badge.label} label={badge.label} variant={badge.variant} />
          ))}
        </div>

        <div className="mt-6 xl:mt-4 grid gap-3 sm:grid-cols-2">
          <DrawerMetric icon={ShoppingBag} label="Pedidos" value={String(user.orders)} />
          <DrawerMetric icon={Wallet} label="Total gastado" value={money(user.total)} />
          <DrawerMetric icon={CalendarDays} label="Alta" value={formatDate(user.createdAt)} />
          <DrawerMetric icon={TrendingUp} label="Última compra" value={user.lastOrder ? formatDate(user.lastOrder.createdAt) : "Sin compras"} />
        </div>

        <div className="mt-6 xl:mt-4 rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4">
          <h3 className="font-semibold text-[#5F3B18]">Último pedido</h3>
          {user.lastOrder ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#8F6A49]">Orden</span>
                <span className="font-semibold text-[#5F3B18]">#{user.lastOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#8F6A49]">Total</span>
                <span className="font-semibold text-[#5F3B18]">{money(user.lastOrder.total)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#8F6A49]">Estado</span>
                <span className="font-semibold text-[#5F3B18]">{user.lastOrder.status}</span>
              </div>
              <Link
                href={`/admin/orders/${user.lastOrder.id}`}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]"
              >
                Ver pedido
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-[#E5D7C8] bg-[#FAF8F5] px-4 py-6 text-center text-sm text-[#8F6A49]">
              Este cliente todavía no realizó compras.
            </div>
          )}
        </div>

        <div className="mt-6 xl:mt-4 rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-[#8B5A2B]" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-[#5F3B18]">Segmentación futura</h3>
              <p className="mt-1 text-sm leading-6 text-[#8F6A49]">
                Este panel queda preparado para notas internas, etiquetas manuales, historial completo y campañas segmentadas.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function DrawerMetric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#E5D7C8] bg-white/70 p-4">
      <Icon className="h-4 w-4 text-[#8B5A2B]" aria-hidden="true" />
      <div className="mt-3 text-xs text-[#A37A55]">{label}</div>
      <div className="mt-1 font-semibold text-[#5F3B18]">{value}</div>
    </div>
  );
}
