import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getCorreoImportOrder, importCorreoShipment } from "@/lib/correoShipmentImport";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const order = await getCorreoImportOrder(id);

  if (!order) {
    return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "paid" && order.status !== "shipped") {
    return NextResponse.json(
      { ok: false, error: "Solo se puede importar un envío de un pedido pagado." },
      { status: 400 }
    );
  }

  try {
    const result = await importCorreoShipment(order);
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status =
      typeof e === "object" && e && "status" in e && typeof e.status === "number"
        ? e.status
        : 502;
    return NextResponse.json(
      { ok: false, error: "No se pudo importar el envío.", details: message },
      { status }
    );
  }
}
