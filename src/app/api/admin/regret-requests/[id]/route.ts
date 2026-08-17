import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

const VALID_STATUSES = new Set(["PENDING", "IN_REVIEW", "RESOLVED", "REJECTED"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { status?: unknown } | null;
  const status = String(body?.status || "").trim().toUpperCase();

  if (!id) return NextResponse.json({ ok: false, error: "Solicitud inválida." }, { status: 400 });
  if (!VALID_STATUSES.has(status)) return NextResponse.json({ ok: false, error: "Estado inválido." }, { status: 400 });

  const request = await prisma.regretRequest.update({
    where: { id },
    data: { status },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ok: true, request });
}
