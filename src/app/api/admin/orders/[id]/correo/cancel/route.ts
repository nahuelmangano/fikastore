import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const shipment = await prisma.correoShipment.findUnique({ where: { orderId: id } });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: "El pedido no tiene envío de Correo." }, { status: 404 });
  }

  if (shipment.status === "CANCELLED_LOCAL" || shipment.status === "CANCELLED") {
    return NextResponse.json({ ok: true, shipment, reused: true });
  }

  const updated = await prisma.correoShipment.update({
    where: { id: shipment.id },
    data: {
      status: "CANCELLED_LOCAL",
      lastResponseJson: JSON.stringify({
        cancelledAt: new Date().toISOString(),
        note: "Marcado como cancelado localmente desde el panel admin. MiCorreo no expone un endpoint publico confiable para cancelar este envio desde la API; confirmar la cancelacion en el portal de Correo Argentino.",
        previousStatus: shipment.status,
        shippingId: shipment.shippingId,
      }),
    },
  });

  return NextResponse.json({ ok: true, shipment: updated, reused: false });
}
