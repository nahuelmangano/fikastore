import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrderContactEmail, normalizeOrderEmail } from "@/lib/orderAccess";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const accessEmail = normalizeOrderEmail(new URL(req.url).searchParams.get("email"));

  const orderId = id;
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "orderId inválido." }, { status: 400 });
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: {
      user: { select: { email: true } },
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  const canAccess = order
    ? isStaffRole(role) || (userId && order.userId === userId) || (accessEmail && getOrderContactEmail(order) === accessEmail)
    : false;

  if (!order || !canAccess) {
    return NextResponse.json({ ok: false, error: "Orden no encontrada." }, { status: 404 });
  }

  const lastPayment = order.payments?.[0] ?? null;

  return NextResponse.json({
    ok: true,
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      items: order.items.map((it) => ({
        productId: it.productId,
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
