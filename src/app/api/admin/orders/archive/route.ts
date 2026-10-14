import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { parseOrderArchiveRequest } from "@/lib/orderArchive";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  let selection: ReturnType<typeof parseOrderArchiveRequest>;
  try {
    selection = parseOrderArchiveRequest(await request.json());
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Solicitud inválida." }, { status: 400 });
  }

  try {
    const result = await prisma.order.updateMany({
      where: { id: { in: selection.orderIds }, archivedAt: selection.archived ? null : { not: null } },
      data: { archivedAt: selection.archived ? new Date() : null },
    });
    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    console.error("No se pudo cambiar el archivo de pedidos", error);
    return NextResponse.json({ ok: false, error: "No se pudieron actualizar los pedidos. Intentá nuevamente." }, { status: 500 });
  }
}
