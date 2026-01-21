import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Nombre inválido" }, { status: 400 });
    data.name = name;
  }

  if (body.slug !== undefined) {
    const slug = slugify(String(body.slug || ""));
    if (!slug) return NextResponse.json({ ok: false, error: "Slug inválido" }, { status: 400 });

    const other = await prisma.product.findUnique({ where: { slug } });
    if (other && other.id !== id) {
      return NextResponse.json({ ok: false, error: "Ese slug ya existe" }, { status: 409 });
    }
    data.slug = slug;
  }

  if (body.description !== undefined) {
    const desc = String(body.description || "").trim();
    data.description = desc || null;
  }

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, error: "Precio inválido" }, { status: 400 });
    data.price = price.toFixed(2);
  }

  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isFinite(stock) || stock < 0) return NextResponse.json({ ok: false, error: "Stock inválido" }, { status: 400 });
    data.stock = stock;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
  });

  return NextResponse.json({ ok: true, product: updated });
}

export async function DELETE(
  _: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  // Borra imágenes primero
  await prisma.productImage.deleteMany({ where: { productId: id } });
  await prisma.product.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
