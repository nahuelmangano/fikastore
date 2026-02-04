import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { orderShippedTemplate } from "@/lib/email-templates";


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
  // Enviar mail al cliente
  const user = await prisma.user.findUnique({ where: { id: updated.userId } });

  if (user?.email) {
    await sendMail({
      to: user.email,
      subject: "FikaStore · Tu pedido fue enviado 📦",
      html: orderShippedTemplate({
        customerName: user.name ?? "",
        orderNumber: updated.orderNumber ?? undefined,
        orderId: updated.id,
      }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, order: updated });
}
