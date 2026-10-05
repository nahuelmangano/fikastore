import type { Prisma } from "@prisma/client";

export const ORDER_PAID_STATUSES = new Set(["paid", "shipped", "delivered"]);

export async function markOrderPaidIfPending(
  tx: Prisma.TransactionClient,
  orderId: string,
  paidAt: Date = new Date(),
) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      paidAt: true,
    },
  });

  if (!order) {
    return { changed: false, status: null as string | null };
  }

  if (order.status !== "pending_payment") {
    return { changed: false, status: order.status };
  }

  await tx.order.update({
    where: { id: orderId },
    data: {
      status: "paid",
      paidAt: order.paidAt ?? paidAt,
    },
  });

  return { changed: true, status: "paid" };
}
