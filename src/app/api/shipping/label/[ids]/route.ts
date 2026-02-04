import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { epickGetToken } from "@/lib/epick";

const EPICK_BASE = process.env.EPICK_BASE_URL || "https://dev-ar.e-pick.com.ar";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ ids: string }> }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { ids } = await params;
  const url = new URL(req.url);
  const type = (url.searchParams.get("type") || "normal").toLowerCase();
  const isThermal = type === "thermal";

  const list = ids
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (list.length === 0) {
    return NextResponse.json({ ok: false, error: "ids requeridos." }, { status: 400 });
  }

  const shipments = await prisma.ePickShipment.findMany({
    where: {
      OR: [{ orderId: { in: list } }, { epickOrderId: { in: list } }],
    },
  });

  if (shipments.length === 0) {
    return NextResponse.json({ ok: false, error: "Envíos no encontrados." }, { status: 404 });
  }

  const invalid = shipments.find(
    (s) => !s.epickOrderId || (s.status !== "PAYED" && s.status !== "CONFIRMED")
  );
  if (invalid) {
    return NextResponse.json(
      { ok: false, error: "Etiquetas solo disponibles para envíos PAYED o CONFIRMED." },
      { status: 400 }
    );
  }

  const epickIds = shipments.map((s) => s.epickOrderId).join(",");
  const token = await epickGetToken();

  const epickUrl = `${EPICK_BASE}/api/orders/label/${epickIds}/${isThermal ? "thermal" : "normal"}?token=${encodeURIComponent(
    token
  )}`;

  const epickRes = await fetch(epickUrl);
  if (!epickRes.ok) {
    const text = await epickRes.text().catch(() => "");
    return NextResponse.json(
      { ok: false, error: "No se pudo descargar etiqueta.", details: text },
      { status: 502 }
    );
  }

  const arrayBuffer = await epickRes.arrayBuffer();
  return new NextResponse(arrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": epickRes.headers.get("content-type") || "application/pdf",
      "Content-Disposition": `inline; filename=epick-label-${isThermal ? "thermal" : "normal"}.pdf`,
    },
  });
}
