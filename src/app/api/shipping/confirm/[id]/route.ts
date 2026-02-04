import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { epickRequest, mapEpickStatus } from "@/lib/epick";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const { id } = await params;

  const shipment = await prisma.ePickShipment.findFirst({
    where: { orderId: id },
    include: { order: true },
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: "Envío no encontrado." }, { status: 404 });
  }

  if (role !== "admin" && shipment.order.userId !== userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  if (shipment.status !== "PAYED") {
    return NextResponse.json(
      { ok: false, error: "Solo se puede confirmar si el envío está en PAYED." },
      { status: 400 }
    );
  }

  try {
    const data = await epickRequest<any>(
      `/api/orders/confirm/${shipment.epickOrderId}/${shipment.senderCode}`,
      { method: "GET" }
    );

    const status = mapEpickStatus(data?.status_name || data?.status || "CONFIRMED");

    const updated = await prisma.ePickShipment.update({
      where: { id: shipment.id },
      data: {
        status,
        lastPayloadJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ ok: true, shipment: updated });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "No se pudo confirmar el envío.", details: String(e?.message || e) },
      { status: 502 }
    );
  }
}
