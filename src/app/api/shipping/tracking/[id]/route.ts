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
    where: {
      OR: [{ orderId: id }, { epickOrderId: id }],
      ...(role === "admin" ? {} : { order: { userId } }),
    },
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: "Envío no encontrado." }, { status: 404 });
  }

  if (shipment.status === "PENDING") {
    return NextResponse.json({ ok: true, tracking: null, status: shipment.status });
  }

  try {
    const data = await epickRequest<any>(`/api/orders/tracking/${shipment.epickOrderId}`, {
      method: "GET",
    });

    const status = mapEpickStatus(data?.status_name || data?.status || shipment.status);

    const updated = await prisma.ePickShipment.update({
      where: { id: shipment.id },
      data: {
        status,
        lastTrackingJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ ok: true, tracking: data, status: updated.status });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "No se pudo consultar tracking.", details: String(e?.message || e) },
      { status: 502 }
    );
  }
}
