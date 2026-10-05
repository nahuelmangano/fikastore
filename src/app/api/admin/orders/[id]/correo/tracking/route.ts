import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { correoArgentinoRequest } from "@/lib/correoArgentino";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

function firstTrackingNumber(data: unknown): string {
  const rows = Array.isArray(data) ? data : [data];

  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const value = item.trackingNumber || item.shippingId || item.id;
    if (value) return String(value);
  }

  return "";
}

function mapCorreoStatus(data: unknown, fallback: string) {
  const rows = Array.isArray(data) ? data : [data];
  const events = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const value = (row as Record<string, unknown>).events;
    return Array.isArray(value) ? value : [];
  });

  const lastEvent = events[0];
  if (!lastEvent || typeof lastEvent !== "object") return fallback;

  const event = String((lastEvent as Record<string, unknown>).event || "").toLowerCase();
  if (event.includes("cancel")) return "CANCELLED";
  if (event.includes("caduca")) return "EXPIRED";
  if (event.includes("entreg")) return "DELIVERED";
  if (event.includes("preimpos")) return "PREIMPOSED";
  if (event.includes("impos") || event.includes("admis")) return "ADMITTED";
  if (event.includes("trans") || event.includes("despach") || event.includes("distrib")) return "IN_TRANSIT";
  return fallback;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

  if (!shipment.shippingId) {
    return NextResponse.json(
      { ok: false, error: "Correo todavía no devolvió número de seguimiento para este envío." },
      { status: 400 }
    );
  }

  try {
    const data = await correoArgentinoRequest<unknown>(
      `/shipping/tracking?shippingId=${encodeURIComponent(shipment.shippingId)}`,
      {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      }
    );

    const trackingNumber = firstTrackingNumber(data);
    const status = mapCorreoStatus(data, shipment.status);
    const updated = await prisma.correoShipment.update({
      where: { id: shipment.id },
      data: {
        status,
        shippingId: trackingNumber || shipment.shippingId,
        lastResponseJson: JSON.stringify(data),
      },
    });

    return NextResponse.json({ ok: true, shipment: updated, tracking: data });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status =
      typeof e === "object" && e && "status" in e && typeof e.status === "number"
        ? e.status
        : 502;

    return NextResponse.json(
      { ok: false, error: "No se pudo consultar tracking de Correo.", details: message },
      { status }
    );
  }
}
