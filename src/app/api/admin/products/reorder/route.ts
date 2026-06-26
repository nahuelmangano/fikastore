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
  const orderedGroups = Array.isArray(body.orderedGroups)
    ? body.orderedGroups
        .map((group) => {
          const item = group && typeof group === "object" ? (group as Record<string, unknown>) : {};
          return {
            id: String(item.id || "").trim(),
            productIds: Array.isArray(item.productIds)
              ? item.productIds.map((value) => String(value || "").trim()).filter(Boolean)
              : [],
          };
        })
        .filter((group) => group.id && group.productIds.length > 0)
    : [];

  if (orderedGroups.length === 0) {
    return NextResponse.json({ ok: false, error: "Orden invalido" }, { status: 400 });
  }

  await prisma.$transaction(
    orderedGroups.flatMap((group, index) =>
      group.productIds.map((productId) =>
        prisma.product.update({
          where: { id: productId },
          data: { sortOrder: index },
        })
      )
    )
  );

  return NextResponse.json({ ok: true });
}
