import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";
import AdminOrderDetail from "./ui";

type AdminOrderDetailPayload = Prisma.OrderGetPayload<{
  include: {
    user: { select: { email: true; name: true } };
    items: {
      include: {
        product: {
          select: {
            images: {
              where: { visible: true };
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }];
              take: 1;
              select: { url: true };
            };
          };
        };
      };
    };
    payments: true;
    epickShipment: true;
    correoShipment: true;
  };
}>;

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: orderId } = await params;
  if (!orderId || typeof orderId !== "string") return notFound();

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { email: true, name: true } },
      items: {
        include: {
          product: {
            select: {
              images: {
                where: { visible: true },
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      },
      payments: { orderBy: { createdAt: "desc" } },
      epickShipment: true,
      correoShipment: true,
    },
  });

  if (!order) return notFound();

  return <AdminOrderDetail order={order as AdminOrderDetailPayload} />;
}
