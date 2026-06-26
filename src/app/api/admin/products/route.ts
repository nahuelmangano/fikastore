import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeRichText } from "@/lib/richText";
import { slugify } from "@/lib/slug";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

type ParsedVariant = {
  name: string;
  stock: number;
};

function variantProductName(baseName: string, variantName: string) {
  const cleanVariantName = variantName.trim();
  return cleanVariantName ? `${baseName} — ${cleanVariantName}` : baseName;
}

async function uniqueSlug(tx: TxClient, value: string, reserved: Set<string>) {
  const base = slugify(value) || "producto";
  let candidate = base;
  let suffix = 2;

  while (reserved.has(candidate) || (await tx.product.findUnique({ where: { slug: candidate }, select: { id: true } }))) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  reserved.add(candidate);
  return candidate;
}

async function nextProductSortOrder(tx: TxClient) {
  const row = await tx.product.aggregate({ _max: { sortOrder: true } });
  return (row._max.sortOrder ?? -1) + 1;
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const name = String(body.name || "").trim();
  const description = sanitizeRichText(String(body.description || "")) || null;
  const price = Number(body.price);
  const isActive = Boolean(body.isActive);
  const categoryId = String(body.categoryId || "").trim() || null;
  const rawVariants = Array.isArray(body.variants) ? body.variants : [];
  const variants: ParsedVariant[] = rawVariants.length > 0
    ? rawVariants.map((item) => {
        const variant = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          name: String(variant.name || "").trim(),
          stock: Number(variant.stock),
        };
      })
    : [{ name: "", stock: Number(body.stock) }];

  let slug = String(body.slug || "").trim();
  slug = slugify(slug || name);

  if (!name) return NextResponse.json({ ok: false, error: "Nombre requerido" }, { status: 400 });
  if (!slug) return NextResponse.json({ ok: false, error: "Slug inválido" }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, error: "Precio inválido" }, { status: 400 });
  if (variants.length === 0) return NextResponse.json({ ok: false, error: "Agregá al menos una variante" }, { status: 400 });
  if (variants.some((variant) => !Number.isFinite(variant.stock) || variant.stock < 0)) {
    return NextResponse.json({ ok: false, error: "Stock inválido" }, { status: 400 });
  }
  if (categoryId) {
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) return NextResponse.json({ ok: false, error: "Categoria invalida" }, { status: 400 });
  }

  const duplicateVariantName = variants.find((variant, index) =>
    variants.some((other, otherIndex) => otherIndex !== index && other.name.toLowerCase() === variant.name.toLowerCase())
  );
  if (duplicateVariantName) {
    return NextResponse.json({ ok: false, error: "Hay variantes con el mismo nombre" }, { status: 400 });
  }

  const { product, products } = await prisma.$transaction(async (tx) => {
    const reservedSlugs = new Set<string>();
    let firstProduct: { id: string; name: string; slug: string } | null = null;
    const createdProducts: Array<{ id: string; name: string; slug: string }> = [];
    const sortOrder = await nextProductSortOrder(tx);

    for (const variant of variants) {
      const productName = variantProductName(name, variant.name);
      const productSlug = variant.name ? await uniqueSlug(tx, productName, reservedSlugs) : await uniqueSlug(tx, slug, reservedSlugs);
      const created = await tx.product.create({
        data: {
          name: productName,
          slug: productSlug,
          description,
          price: price.toFixed(2),
          stock: Math.floor(variant.stock),
          isActive,
          categoryId,
          sortOrder,
        },
        select: { id: true, name: true, slug: true },
      });

      if (!firstProduct) firstProduct = created;
      createdProducts.push(created);
    }

    return { product: firstProduct, products: createdProducts };
  });

  return NextResponse.json({ ok: true, product, products });
}
