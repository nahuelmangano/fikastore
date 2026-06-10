import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function nextSortOrder(productId: string) {
  const maxSort = await prisma.productImage.aggregate({
    where: { productId },
    _max: { sortOrder: true },
  });

  return (maxSort._max.sortOrder ?? 0) + 1;
}

export async function POST(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const productIdsRaw = form.getAll("productIds");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Archivo requerido (field: file)" }, { status: 400 });
  }

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const productIds = Array.from(
    new Set(
      productIdsRaw
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
  const targetProductIds = productIds.length > 0 ? productIds : [product.id];

  if (!targetProductIds.includes(product.id)) targetProductIds.push(product.id);

  const targetProducts = await prisma.product.findMany({
    where: { id: { in: targetProductIds } },
    select: { id: true },
  });
  const validTargetIds = targetProducts.map((item) => item.id);

  if (validTargetIds.length === 0) {
    return NextResponse.json({ ok: false, error: "No hay variantes validas para asignar imagen" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${crypto.randomUUID()}-${safeName(file.name)}`;
  const filepath = path.join(uploadsDir, filename);

  await writeFile(filepath, bytes);

  const url = `/uploads/${filename}`;

  const images = [];
  for (const productId of validTargetIds) {
    images.push(
      await prisma.productImage.create({
        data: {
          productId,
          url,
          sortOrder: await nextSortOrder(productId),
        },
      })
    );
  }

  return NextResponse.json({
    ok: true,
    image: images.find((image) => image.productId === product.id) ?? images[0],
    images,
  });
}
