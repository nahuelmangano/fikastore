import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";
import { isStaffRole } from "@/lib/roles";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json({ ok: true, categories: flattenCategories(categories) });
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim() || null;
  const parentId = String(body.parentId || "").trim() || null;
  const slug = slugify(String(body.slug || "").trim() || name);

  if (!name) return NextResponse.json({ ok: false, error: "Nombre requerido" }, { status: 400 });
  if (!slug) return NextResponse.json({ ok: false, error: "Slug invalido" }, { status: 400 });

  const exists = await prisma.category.findUnique({ where: { slug } });
  if (exists) return NextResponse.json({ ok: false, error: "Ese slug ya existe" }, { status: 409 });
  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: parentId }, select: { id: true } });
    if (!parent) return NextResponse.json({ ok: false, error: "Categoria padre invalida" }, { status: 400 });
  }

  const category = await prisma.category.create({
    data: { name, slug, description, parentId },
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json({ ok: true, category });
}
