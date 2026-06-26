import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { slugify } from "@/lib/slug";

export const runtime = "nodejs";

type TxClient = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
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

export async function POST(
  _: Request,
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

  const { baseName } = splitProductName(source.name);
  const variants = await prisma.product.findMany({
    where: {
      OR: [{ name: baseName }, { name: { startsWith: `${baseName} —` } }],
    },
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ name: "asc" }],
  });

  const sourceProducts = variants.length > 0 ? variants : [source];
  const copyBaseName = `${baseName} copia`;

  const result = await prisma.$transaction(async (tx) => {
    let firstCreated: { id: string; slug: string; name: string } | null = null;

    for (const item of sourceProducts) {
      const { variantName } = splitProductName(item.name);
      const name = variantName ? `${copyBaseName} — ${variantName}` : copyBaseName;
      const slug = await uniqueSlug(tx, name);

      const created = await tx.product.create({
        data: {
          categoryId: item.categoryId,
          name,
          slug,
          description: item.description,
          price: item.price,
          stock: item.stock,
          isActive: item.isActive,
        },
        select: { id: true, slug: true, name: true },
      });

      if (item.images.length > 0) {
        await tx.productImage.createMany({
          data: item.images.map((image) => ({
            productId: created.id,
            url: image.url,
            sortOrder: image.sortOrder,
          })),
        });
      }

      if (item.id === source.id || !firstCreated) {
        firstCreated = created;
      }
    }

    return firstCreated;
  });

  if (!result) {
    return NextResponse.json({ ok: false, error: "No se pudo duplicar el producto" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, product: result });
}
