import type { Prisma } from "@prisma/client";

type CancelPendingOrderResult =
  | { ok: true; restoredProductIds: string[]; paymentIds: string[] }
  | { ok: false; reason: "not_found" | "invalid_status" | "approved_payment" };

export async function cancelPendingOrderInTransaction(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<CancelPendingOrderResult> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true, payments: true },
  });

  if (!order) return { ok: false, reason: "not_found" };
  if (order.status !== "pending_payment") return { ok: false, reason: "invalid_status" };
  if (order.payments.some((payment) => payment.status === "approved")) return { ok: false, reason: "approved_payment" };

  const restoredProductIds = new Set<string>();

  await tx.order.update({
    where: { id: order.id },
    data: { status: "cancelled" },
  });

  for (const item of order.items) {
    const product = await tx.product.findUnique({
      where: { id: item.productId },
      select: { stock: true },
    });

    if (item.productVariantId) {
      await tx.productVariant.update({
        where: { id: item.productVariantId },
        data: { stock: { increment: item.quantity } },
      });
    }

    const updatedProduct = await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
      select: { id: true, stock: true },
    });

    if ((product?.stock ?? 0) <= 0 && updatedProduct.stock > 0) {
      restoredProductIds.add(updatedProduct.id);
    }
  }

  const cancellablePaymentIds = order.payments
    .filter((payment) => payment.status === "pending" || payment.status === "unknown")
    .map((payment) => payment.id);

  if (cancellablePaymentIds.length > 0) {
    await tx.payment.updateMany({
      where: { id: { in: cancellablePaymentIds } },
      data: { status: "cancelled" },
    });
  }

  return {
    ok: true,
    restoredProductIds: Array.from(restoredProductIds),
    paymentIds: cancellablePaymentIds,
  };
}
