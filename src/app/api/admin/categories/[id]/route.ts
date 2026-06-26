import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCategoryAndDescendantIds } from "@/lib/categories";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Categoria no existe" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: { name?: string; slug?: string; description?: string | null; parentId?: string | null } = {};

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Nombre invalido" }, { status: 400 });
    data.name = name;
  }

  if (body.slug !== undefined) {
    const slug = slugify(String(body.slug || ""));
    if (!slug) return NextResponse.json({ ok: false, error: "Slug invalido" }, { status: 400 });

    const other = await prisma.category.findUnique({ where: { slug } });
    if (other && other.id !== id) {
      return NextResponse.json({ ok: false, error: "Ese slug ya existe" }, { status: 409 });
    }
    data.slug = slug;
  }

  if (body.description !== undefined) {
    const description = String(body.description || "").trim();
    data.description = description || null;
  }

  if (body.parentId !== undefined) {
    const parentId = String(body.parentId || "").trim() || null;
    if (parentId === id) {
      return NextResponse.json({ ok: false, error: "Una categoria no puede ser su propia subcategoria" }, { status: 400 });
    }

    if (parentId) {
      const [parent, current] = await Promise.all([
        prisma.category.findUnique({ where: { id: parentId }, select: { id: true } }),
        prisma.category.findUnique({ where: { id }, select: { slug: true } }),
      ]);
      if (!parent) return NextResponse.json({ ok: false, error: "Categoria padre invalida" }, { status: 400 });
      if (!current) return NextResponse.json({ ok: false, error: "Categoria no existe" }, { status: 404 });

      const descendantIds = await getCategoryAndDescendantIds(current.slug);
      if (descendantIds.includes(parentId)) {
        return NextResponse.json({ ok: false, error: "No se puede elegir una subcategoria como padre" }, { status: 400 });
      }
    }

    data.parentId = parentId;
  }

  const category = await prisma.category.update({
    where: { id },
    data,
    include: { _count: { select: { products: true } } },
  });

  return NextResponse.json({ ok: true, category });
}

export async function DELETE(
  _: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Categoria no existe" }, { status: 404 });

  await prisma.$transaction([
    prisma.category.updateMany({ where: { parentId: id }, data: { parentId: null } }),
    prisma.category.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
