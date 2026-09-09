import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/roles";
import { getMetricsSettings } from "@/lib/storeSettings";
import AdminStatsDashboard from "./ui";

const SALES_STATUSES = ["paid", "shipped"] as const;

function parseCartItems(itemsJson: string) {
  try {
    const items = JSON.parse(itemsJson);
    return Array.isArray(items)
      ? items.map((item) => ({ name: String(item?.name || "Producto"), quantity: Number(item?.quantity) || 0, price: Number(item?.price) || 0 }))
      : [];
  } catch {
    return [];
  }
}

export default async function AdminEstadisticasPage() {
  const session = await auth();
  const isAdmin = isAdminRole((session?.user as { role?: string } | undefined)?.role);
  const metricsSettings = await getMetricsSettings();
  const metricsStartAt = metricsSettings.startAt ? new Date(metricsSettings.startAt) : null;
  const [salesOrders, lowStockProducts, abandonedCarts, anonymousCarts] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: { in: [...SALES_STATUSES] },
        ...(metricsStartAt ? { createdAt: { gte: metricsStartAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        userId: true,
        items: {
          select: {
            id: true,
            productId: true,
            nameSnapshot: true,
            unitPrice: true,
            quantity: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                stock: true,
                isActive: true,
                images: {
                  orderBy: { sortOrder: "asc" },
                  take: 1,
                  select: { url: true },
                },
                category: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
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
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { url: true },
        },
      },
    }),
    prisma.cartSnapshot.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: {
        id: true,
        itemsJson: true,
        itemCount: true,
        reminderSentAt: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.anonymousCartSnapshot.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, itemsJson: true, itemCount: true, createdAt: true, updatedAt: true },
    }),
  ]);

  return (
    <AdminStatsDashboard
      salesOrders={salesOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        status: order.status,
        userId: order.userId,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          nameSnapshot: item.nameSnapshot,
          unitPrice: Number(item.unitPrice),
          quantity: item.quantity,
          subtotal: Number(item.subtotal),
          product: item.product
            ? {
                id: item.product.id,
                name: item.product.name,
                slug: item.product.slug,
                stock: item.product.stock,
                isActive: item.product.isActive,
                imageUrl: item.product.images[0]?.url ?? null,
                category: item.product.category
                  ? {
                      id: item.product.category.id,
                      name: item.product.category.name,
                      slug: item.product.category.slug,
                    }
                  : null,
              }
            : null,
        })),
      }))}
      lowStockProducts={lowStockProducts.map((product) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        stock: product.stock,
        isActive: product.isActive,
        imageUrl: product.images[0]?.url ?? null,
      }))}
      showAbandonedCarts={isAdmin}
      salesStatuses={[...SALES_STATUSES]}
      metricsStartAt={metricsSettings.startAt}
      abandonedCarts={isAdmin ? [
        ...abandonedCarts.map((cart) => ({
        id: cart.id,
        customerName: cart.user.name || cart.user.email,
        customerEmail: cart.user.email,
        itemCount: cart.itemCount,
        total: parseCartItems(cart.itemsJson).reduce((sum, item) => sum + item.price * item.quantity, 0),
        items: parseCartItems(cart.itemsJson).map((item) => ({ name: item.name, quantity: item.quantity })),
        reminderSentAt: cart.reminderSentAt?.toISOString() ?? null,
        createdAt: cart.createdAt.toISOString(),
        updatedAt: cart.updatedAt.toISOString(),
        })),
        ...anonymousCarts.map((cart) => ({
          id: `anonymous-${cart.id}`,
          customerName: "Visitante anónimo",
          customerEmail: "Sin email registrado",
          itemCount: cart.itemCount,
          total: parseCartItems(cart.itemsJson).reduce((sum, item) => sum + item.price * item.quantity, 0),
          items: parseCartItems(cart.itemsJson).map((item) => ({ name: item.name, quantity: item.quantity })),
          reminderSentAt: null,
          createdAt: cart.createdAt.toISOString(),
          updatedAt: cart.updatedAt.toISOString(),
        })),
      ] : []}
    />
  );
}
