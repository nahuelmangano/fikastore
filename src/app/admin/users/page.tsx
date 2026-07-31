import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";
import AdminUsersCrm from "./ui";

export default async function AdminUsersPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = isAdminRole(role);

  const usersWhere = isAdmin ? {} : { role: "customer" as const };

  const users = await prisma.user.findMany({
    where: usersWhere,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
        },
      },
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

  return (
    <AdminUsersCrm
      isAdmin={isAdmin}
      users={users.map((u) => {
        const stat = statsByUser.get(u.id);
        const lastOrder = u.orders[0] ?? null;
        return {
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          createdAt: u.createdAt.toISOString(),
          orders: stat?.orders ?? 0,
          total: stat?.total ?? 0,
          lastOrder: lastOrder
            ? {
                id: lastOrder.id,
                orderNumber: lastOrder.orderNumber,
                total: Number(lastOrder.total),
                status: lastOrder.status,
                createdAt: lastOrder.createdAt.toISOString(),
              }
            : null,
        };
      })}
    />
  );
}
