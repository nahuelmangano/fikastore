import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AdminOrderDetail from "./ui";

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
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
      epickShipment: true,
    },
  });

  if (!order) return notFound();

  return <AdminOrderDetail order={order as any} />;
}
