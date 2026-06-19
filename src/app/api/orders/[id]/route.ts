import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const orderId = id;
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId inválido." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  const lastPayment = order.payments?.[0] ?? null;

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items.map((it) => ({
        name: it.nameSnapshot,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        subtotal: Number(it.subtotal),
      })),
      payment: lastPayment
        ? {
            provider: lastPayment.provider,
            status: lastPayment.status,
            preferenceId: lastPayment.preferenceId,
            paymentId: lastPayment.paymentId,
          }
        : null,
    },
  });
}
