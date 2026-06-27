import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const parentId = String(body.parentId || "").trim() || null;
  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  if (orderedIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Orden invalido" }, { status: 400 });
  }

  const siblings = await prisma.category.findMany({
    where: { parentId },
    select: { id: true },
    orderBy: [{ name: "asc" }],
  });

  if (siblings.length !== orderedIds.length) {
    return NextResponse.json({ ok: false, error: "Orden incompleto" }, { status: 400 });
  }

  const siblingIds = siblings.map((item) => item.id).sort();
  const nextIds = [...orderedIds].sort();
  if (JSON.stringify(siblingIds) !== JSON.stringify(nextIds)) {
    return NextResponse.json({ ok: false, error: "Las categorias no pertenecen al mismo nivel" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
