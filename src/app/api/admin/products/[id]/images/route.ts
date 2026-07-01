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

function parseProductIds(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const url = String(body.url || "").trim();
    if (!url) return NextResponse.json({ ok: false, error: "URL requerida" }, { status: 400 });

    const productIds = parseProductIds(body.productIds);
    const targetProductIds = Array.from(new Set(productIds.length > 0 ? productIds : [product.id]));
    if (!targetProductIds.includes(product.id)) targetProductIds.push(product.id);

    const targetProducts = await prisma.product.findMany({
      where: { id: { in: targetProductIds } },
      select: { id: true },
    });
    const validTargetIds = targetProducts.map((item) => item.id);

    if (validTargetIds.length === 0) {
      return NextResponse.json({ ok: false, error: "No hay variantes validas para asignar imagen" }, { status: 400 });
    }

    const images = [];
    for (const productId of validTargetIds) {
      const existing = await prisma.productImage.findFirst({ where: { productId, url } });
      if (existing) {
        images.push(existing);
        continue;
      }

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

  const form = await req.formData();
  const files = form.getAll("file").filter((file): file is File => file instanceof File);
  const productIdsRaw = form.getAll("productIds");

  if (files.length === 0) {
    return NextResponse.json({ ok: false, error: "Archivo requerido (field: file)" }, { status: 400 });
  }

  if (files.some((file) => !file.type.startsWith("image/"))) {
    return NextResponse.json({ ok: false, error: "Todos los archivos deben ser imagenes" }, { status: 400 });
  }

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

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const images = [];
  const sortOrders = new Map<string, number>();
  for (const productId of validTargetIds) {
    sortOrders.set(productId, await nextSortOrder(productId));
  }

  for (const file of files) {
    const bytes = Buffer.from(await file.arrayBuffer());
    const filename = `${crypto.randomUUID()}-${safeName(file.name)}`;
    const filepath = path.join(uploadsDir, filename);

    await writeFile(filepath, bytes);

    const url = `/uploads/${filename}`;

    for (const productId of validTargetIds) {
      const sortOrder = sortOrders.get(productId) ?? 1;
      images.push(
        await prisma.productImage.create({
          data: {
            productId,
            url,
            sortOrder,
          },
        })
      );
      sortOrders.set(productId, sortOrder + 1);
    }
  }

  return NextResponse.json({
    ok: true,
    image: images.find((image) => image.productId === product.id) ?? images[0],
    images,
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const imageIds = Array.isArray(body.imageIds) ? body.imageIds.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls.map((item) => String(item || "").trim()).filter(Boolean) : [];
  if (imageIds.length === 0 && imageUrls.length === 0) {
    return NextResponse.json({ ok: false, error: "Orden requerido" }, { status: 400 });
  }

  if (imageIds.length > 0) {
    const existing = await prisma.productImage.findMany({
      where: { productId: id, id: { in: imageIds } },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((image) => image.id));
    if (existingIds.size !== imageIds.length) {
      return NextResponse.json({ ok: false, error: "Hay imagenes que no pertenecen a esta variante" }, { status: 400 });
    }
  }

  const productIds = parseProductIds(body.productIds);
  const targetProductIds = Array.from(new Set(productIds.length > 0 ? productIds : [id]));
  if (!targetProductIds.includes(id)) targetProductIds.push(id);

  const targetProducts = await prisma.product.findMany({
    where: { id: { in: targetProductIds } },
    select: { id: true },
  });
  const validTargetIds = targetProducts.map((item) => item.id);

  const updates =
    imageUrls.length > 0
      ? validTargetIds.flatMap((productId) =>
          imageUrls.map((url, index) =>
            prisma.productImage.updateMany({
              where: { productId, url },
              data: { sortOrder: index + 1 },
            })
          )
        )
      : imageIds.map((imageId, index) =>
          prisma.productImage.updateMany({
            where: { id: imageId },
            data: { sortOrder: index + 1 },
          })
        );

  await prisma.$transaction(updates);

  const images = await prisma.productImage.findMany({
    where: { productId: id },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  const allImages = await prisma.productImage.findMany({
    where: { productId: { in: validTargetIds } },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return NextResponse.json({
    ok: true,
    images,
    allImages,
  });
}
