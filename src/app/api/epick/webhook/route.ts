import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { canTransition, mapEpickStatus } from "@/lib/epick";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));

  const epickOrderId = String(payload?.id || payload?.order_id || "").trim();
  const senderCode = String(payload?.sender_code || payload?.senderCode || "").trim();
  const nextStatus = mapEpickStatus(payload?.status_name || payload?.status);

  if (!epickOrderId || !senderCode) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const shipment = await prisma.ePickShipment.findFirst({
    where: { epickOrderId, senderCode },
  });

  if (!shipment) {
    return NextResponse.json({ ok: false, error: "Envío no encontrado." }, { status: 404 });
  }

  await prisma.ePickWebhookEvent.create({
    data: {
      epickShipmentId: shipment.id,
      payloadJson: JSON.stringify(payload),
    },
  });

  if (canTransition(shipment.status, nextStatus)) {
    await prisma.ePickShipment.update({
      where: { id: shipment.id },
      data: {
        status: nextStatus,
        lastPayloadJson: JSON.stringify(payload),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
