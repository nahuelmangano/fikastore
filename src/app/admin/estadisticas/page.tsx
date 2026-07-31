import { prisma } from "@/lib/prisma";
import AdminStatsDashboard from "./ui";

const SALES_STATUSES = ["paid", "shipped"] as const;

export default async function AdminEstadisticasPage() {
  const [salesOrders, lowStockProducts] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: [...SALES_STATUSES] } },
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
      salesStatuses={[...SALES_STATUSES]}
    />
  );
}
