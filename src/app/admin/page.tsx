import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

type AdminRoute = {
  href: string;
  title: string;
  description: string;
};

const ADMIN_ROUTES: AdminRoute[] = [
  {
    href: "/admin/users",
    title: "Usuarios",
    description: "Ver datos y actividad de los usuarios.",
  },
  {
    href: "/admin/estadisticas",
    title: "Estadísticas",
    description: "Producto más vendido, ticket promedio y alertas de stock.",
  },
  {
    href: "/admin/promociones",
    title: "Promociones",
    description: "Descuentos globales, por producto y códigos promocionales.",
  },
  {
    href: "/admin/products",
    title: "Productos",
    description: "Alta, edición, stock y estado de catálogo.",
  },
  {
    href: "/admin/orders",
    title: "Pedidos",
    description: "Seguimiento, estados y acciones sobre órdenes.",
  },
  {
    href: "/admin/paqueteria",
    title: "Paquetería",
    description: "Habilitar/deshabilitar proveedores de envío.",
  },
  {
    href: "/admin/settings",
    title: "Configuracion",
    description: "Editar el texto superior de promociones en la tienda.",
  },
];

const ADMIN_ONLY_ROUTES: AdminRoute[] = [
  {
    href: "/admin/users/new",
    title: "Alta merchant",
    description: "Crear usuarios merchant (solo admin).",
  },
];

export default async function AdminDashboardPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = isAdminRole(role);
  const routes = isAdmin ? [...ADMIN_ROUTES, ...ADMIN_ONLY_ROUTES] : ADMIN_ROUTES;

  const usersWhere = isAdmin
    ? { role: { in: ["admin", "merchant"] } }
    : { role: "customer" };

  const users = await prisma.user.findMany({
    where: usersWhere,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
    },
  });

  const userIds = users.map((u) => u.id);
  const orderStats =
    userIds.length > 0
      ? await prisma.order.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds } },
          _count: { _all: true },
          _sum: { total: true },
        })
      : [];

  const statsByUser = new Map(
    orderStats.map((s) => [
      s.userId,
      {
        orders: s._count._all,
        total: Number(s._sum.total ?? 0),
      },
    ])
  );

  const totalUsers = users.length;
  const adminUsers = users.filter((u) => u.role === "admin").length;
  const merchantUsers = users.filter((u) => u.role === "merchant").length;
  const customerUsers = users.filter((u) => u.role === "customer").length;
  const usersWithOrders = users.filter((u) => (statsByUser.get(u.id)?.orders ?? 0) > 0).length;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-400">Accesos rápidos y resumen de usuarios del sistema.</p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Rutas administrativas</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 hover:bg-zinc-900/50"
              >
                <div className="text-base font-semibold">{route.title}</div>
                <p className="mt-2 text-sm text-zinc-400">{route.description}</p>
                <div className="mt-3 font-mono text-xs text-zinc-500">{route.href}</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">Dashboard de usuarios</h2>
          <div className={`mt-4 grid gap-3 ${isAdmin ? "md:grid-cols-4" : "md:grid-cols-2"}`}>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-xs text-zinc-400">Usuarios totales</div>
              <div className="mt-1 text-2xl font-semibold">{totalUsers}</div>
            </div>
            {isAdmin ? (
              <>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="text-xs text-zinc-400">Admins</div>
                  <div className="mt-1 text-2xl font-semibold">{adminUsers}</div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                  <div className="text-xs text-zinc-400">Merchants</div>
                  <div className="mt-1 text-2xl font-semibold">{merchantUsers}</div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
                <div className="text-xs text-zinc-400">Clientes</div>
                <div className="mt-1 text-2xl font-semibold">{customerUsers}</div>
              </div>
            )}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-xs text-zinc-400">Con pedidos</div>
              <div className="mt-1 text-2xl font-semibold">{usersWithOrders}</div>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-900/40">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="px-4 py-3">Usuario</th>
                    <th className="px-4 py-3">Rol</th>
                    <th className="px-4 py-3">Pedidos</th>
                    <th className="px-4 py-3">Total comprado</th>
                    <th className="px-4 py-3">Alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-950/20">
                  {users.map((u) => {
                    const stat = statsByUser.get(u.id);
                    return (
                      <tr key={u.id} className="text-sm">
                        <td className="px-4 py-3">
                          <div className="font-medium">{u.name || "Sin nombre"}</div>
                          <div className="mt-0.5 text-xs text-zinc-400">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              "inline-flex rounded-full border px-2 py-0.5 text-xs",
                              u.role === "admin"
                                ? "border-emerald-900/40 bg-emerald-900/20 text-emerald-200"
                                : u.role === "merchant"
                                ? "border-cyan-900/40 bg-cyan-900/20 text-cyan-200"
                                : "border-zinc-800 bg-zinc-900/40 text-zinc-300",
                            ].join(" ")}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">{stat?.orders ?? 0}</td>
                        <td className="px-4 py-3">${(stat?.total ?? 0).toLocaleString("es-AR")}</td>
                        <td className="px-4 py-3 text-zinc-400">
                          {new Date(u.createdAt).toLocaleString("es-AR")}
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                        No hay usuarios registrados.
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
