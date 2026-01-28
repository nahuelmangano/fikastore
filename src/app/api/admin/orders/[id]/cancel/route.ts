import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true, payments: true },
      });

      if (!order) {
        throw new Error("not_found");
      }

      if (order.status !== "pending_payment") {
        throw new Error("invalid_status");
      }

      const changed = await tx.order.update({
        where: { id: order.id },
        data: { status: "cancelled" },
      });

      for (const it of order.items) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity } },
        });
      }

      if (order.payments.length > 0) {
        await tx.payment.updateMany({
          where: { orderId: order.id, status: "pending" },
          data: { status: "cancelled" },
        });
      }

      return changed;
    });

    return NextResponse.json({ ok: true, order: updated });
  } catch (err: any) {
    if (err?.message === "not_found") {
      return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
    }
    if (err?.message === "invalid_status") {
      return NextResponse.json(
        { ok: false, error: "Solo se puede cancelar si está pending_payment." },
        { status: 400 }
      );
    }
    console.error("admin cancel order error", err);
    return NextResponse.json({ ok: false, error: "Error cancelando la orden." }, { status: 500 });
  }
}
