import { NextResponse } from "next/server";
import { auth } from "@/auth";
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

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; slug?: string; description?: string | null } = {};

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

  await prisma.category.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
