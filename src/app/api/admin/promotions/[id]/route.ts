import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const resolvedParams = await Promise.resolve(params);
  const id = String(resolvedParams?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Id inválido." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as { isActive?: boolean } | null;
  if (typeof body?.isActive !== "boolean") {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const updated = await prisma.promotion.update({
    where: { id },
    data: { isActive: body.isActive },
    select: { id: true, isActive: true },
  });

  return NextResponse.json({ ok: true, promotion: updated });
}
