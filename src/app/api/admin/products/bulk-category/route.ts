import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const productIds: string[] = Array.isArray(body.productIds)
    ? Array.from(
        new Set(
          body.productIds
            .map((id: unknown) => String(id || "").trim())
            .filter((id: string) => id.length > 0)
        )
      )
    : [];
  const categoryId = String(body.categoryId || "").trim() || null;

  if (productIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Selecciona al menos un producto." }, { status: 400 });
  }

  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ ok: false, error: "Categoria invalida" }, { status: 400 });
  }

  const result = await prisma.product.updateMany({
    where: { id: { in: productIds } },
    data: { categoryId },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
