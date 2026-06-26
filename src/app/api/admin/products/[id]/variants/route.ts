import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { sanitizeRichText } from "@/lib/richText";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

function splitProductName(name: string) {
  const [base] = name.split(/\s+—\s+/);
  return (base || name).trim();
}

async function uniqueSlug(tx: TxClient, value: string) {
  const base = slugify(value) || "producto";
  let candidate = base;
  let suffix = 2;

  while (await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function nextProductSortOrder(tx: TxClient) {
  const row = await tx.product.aggregate({ _max: { sortOrder: true } });
  return (row._max.sortOrder ?? -1) + 1;
}

export async function POST(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const source = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const variantName = String(body.variantName || "").trim();
  const stock = Number(body.stock);
  const price = body.price !== undefined ? Number(body.price) : Number(source.price);
  const description =
    body.description !== undefined ? sanitizeRichText(String(body.description || "")) || null : source.description;
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : source.isActive;
  const categoryId = body.categoryId !== undefined ? String(body.categoryId || "").trim() || null : source.categoryId;

  if (!variantName) return NextResponse.json({ ok: false, error: "Nombre de variante requerido" }, { status: 400 });
  if (!Number.isFinite(stock) || stock < 0) return NextResponse.json({ ok: false, error: "Stock inválido" }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, error: "Precio inválido" }, { status: 400 });

  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ ok: false, error: "Categoria invalida" }, { status: 400 });
  }

  const baseName = splitProductName(source.name);
  const name = `${baseName} — ${variantName}`;
  const existing = await prisma.product.findFirst({ where: { name }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, error: "Esa variante ya existe" }, { status: 409 });

  const product = await prisma.$transaction(async (tx) => {
    const slug = await uniqueSlug(tx, name);
    const sortOrder = source.sortOrder ?? (await nextProductSortOrder(tx));
    const created = await tx.product.create({
      data: {
        categoryId,
        name,
        slug,
        description,
        price: price.toFixed(2),
        stock: Math.floor(stock),
        isActive,
        sortOrder,
      },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: { select: { id: true, name: true } },
      },
    });

    if (source.images.length > 0) {
      await tx.productImage.createMany({
        data: source.images.map((image) => ({
          productId: created.id,
          url: image.url,
          sortOrder: image.sortOrder,
        })),
      });
    }

    return tx.product.findUnique({
      where: { id: created.id },
      include: {
        images: { orderBy: { sortOrder: "asc" } },
        category: { select: { id: true, name: true } },
      },
    });
  });

  return NextResponse.json({ ok: true, product });
}
