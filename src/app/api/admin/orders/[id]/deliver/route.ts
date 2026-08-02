import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { scheduleReviewRequestForOrder } from "@/lib/emailNotificationJobs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ ok: false, error: "Pedido no encontrado." }, { status: 404 });

  if (order.status !== "shipped" && order.status !== "paid") {
    return NextResponse.json({ ok: false, error: "Solo se puede marcar como entregado un pedido pagado o enviado." }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "delivered",
      deliveredAt: order.deliveredAt || new Date(),
    },
  });

  await scheduleReviewRequestForOrder(updated.id).catch((error) => {
    console.error("review request scheduling failed", error instanceof Error ? error.message : error);
  });

  return NextResponse.json({ ok: true, order: updated });
}
