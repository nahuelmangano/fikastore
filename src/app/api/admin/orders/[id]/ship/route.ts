import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
  });

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  // Regla simple MVP: solo podés enviar si está paid
  if (order.status !== "paid") {
    return NextResponse.json(
      { ok: false, error: "Solo se puede marcar como enviado un pedido pagado." },
      { status: 400 }
    );
  }

  const updated = await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "shipped",
      shippedAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true, order: updated });
}
