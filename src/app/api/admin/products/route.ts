import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  const name = String(body.name || "").trim();
  const description = String(body.description || "").trim() || null;
  const price = Number(body.price);
  const stock = Number(body.stock);
  const isActive = Boolean(body.isActive);
  const categoryId = String(body.categoryId || "").trim() || null;

  let slug = String(body.slug || "").trim();
  slug = slugify(slug || name);

  if (!name) return NextResponse.json({ ok: false, error: "Nombre requerido" }, { status: 400 });
  if (!slug) return NextResponse.json({ ok: false, error: "Slug inválido" }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, error: "Precio inválido" }, { status: 400 });
  if (!Number.isFinite(stock) || stock < 0) return NextResponse.json({ ok: false, error: "Stock inválido" }, { status: 400 });
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ ok: false, error: "Categoria invalida" }, { status: 400 });
  }

  const exists = await prisma.product.findUnique({ where: { slug } });
  if (exists) return NextResponse.json({ ok: false, error: "Ese slug ya existe" }, { status: 409 });

  const product = await prisma.product.create({
    data: {
      name,
      slug,
      description,
      price: price.toFixed(2),
      stock,
      isActive,
      categoryId,
    },
  });

  return NextResponse.json({ ok: true, product });
}
