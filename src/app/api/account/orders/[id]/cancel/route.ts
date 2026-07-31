import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyBackInStock } from "@/lib/stockNotifications";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { id: orderId } = await params;
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  try {
    const restoredProductIds = new Set<string>();

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true, payments: true },
      });

      if (!order) {
        throw new Error("not_found");
      }

      if (order.status !== "pending_payment") {
        throw new Error("invalid_status");
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: "cancelled" },
      });

      for (const it of order.items) {
        const product = await tx.product.findUnique({
          where: { id: it.productId },
          select: { stock: true },
        });

        const updatedProduct = await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity } },
          select: { id: true, stock: true },
        });

        if ((product?.stock ?? 0) <= 0 && updatedProduct.stock > 0) {
          restoredProductIds.add(updatedProduct.id);
        }
      }

      if (order.payments.length > 0) {
        await tx.payment.updateMany({
          where: { orderId: order.id, status: "pending" },
          data: { status: "cancelled" },
        });
      }
    });

    await Promise.all(Array.from(restoredProductIds).map((productId) => notifyBackInStock(productId, req)));
  } catch (err: any) {
    if (err?.message === "not_found") {
      return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
    }
    if (err?.message === "invalid_status") {
      return NextResponse.json(
        { ok: false, error: "La orden no se puede cancelar en este estado." },
        { status: 400 }
      );
    }
    console.error("cancel order error", err);
    return NextResponse.json({ ok: false, error: "Error cancelando la orden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
