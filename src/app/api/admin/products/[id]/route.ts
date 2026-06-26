import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { isStaffRole } from "@/lib/roles";
import { sanitizeRichText } from "@/lib/richText";

export const runtime = "nodejs";

function splitProductName(name: string) {
  const [base] = name.split(/\s+—\s+/);
  return (base || name).trim();
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

  const currentProduct = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!currentProduct) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Prisma.ProductUncheckedUpdateInput = {};
  let priceForVariants: string | null = null;
  let categoryIdForVariants: string | null | undefined;
  let descriptionForVariants: string | null | undefined;

  if (body.name !== undefined) {
    const name = String(body.name || "").trim();
    if (!name) return NextResponse.json({ ok: false, error: "Nombre invalido" }, { status: 400 });
    data.name = name;
  }

  if (body.slug !== undefined) {
    const slug = slugify(String(body.slug || ""));
    if (!slug) return NextResponse.json({ ok: false, error: "Slug invalido" }, { status: 400 });

    const other = await prisma.product.findUnique({ where: { slug } });
    if (other && other.id !== id) {
      return NextResponse.json({ ok: false, error: "Ese slug ya existe" }, { status: 409 });
    }
    data.slug = slug;
  }

  if (body.description !== undefined) {
    const desc = sanitizeRichText(String(body.description || ""));
    data.description = desc || null;
    descriptionForVariants = desc || null;
  }

  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0) return NextResponse.json({ ok: false, error: "Precio invalido" }, { status: 400 });
    priceForVariants = price.toFixed(2);
    data.price = priceForVariants;
  }

  if (body.stock !== undefined) {
    const stock = Number(body.stock);
    if (!Number.isFinite(stock) || stock < 0) return NextResponse.json({ ok: false, error: "Stock invalido" }, { status: 400 });
    data.stock = stock;
  }

  if (body.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (body.categoryId !== undefined) {
    const categoryId = String(body.categoryId || "").trim();
    if (!categoryId) {
      data.categoryId = null;
      categoryIdForVariants = null;
    } else {
      const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
      if (!category) return NextResponse.json({ ok: false, error: "Categoria invalida" }, { status: 400 });
      data.categoryId = categoryId;
      categoryIdForVariants = categoryId;
    }
  }

  const variantIds = Array.isArray(body.variantIds)
    ? Array.from(new Set(body.variantIds.map((value) => String(value || "").trim()).filter(Boolean)))
    : [];
  const baseName = splitProductName(currentProduct.name);

  const updated = await prisma.$transaction(async (tx) => {
    const updatedProduct = await tx.product.update({
      where: { id },
      data,
    });

    if ((priceForVariants || categoryIdForVariants !== undefined || descriptionForVariants !== undefined || body.isActive !== undefined) && variantIds.length > 0) {
      const variantData: Prisma.ProductUncheckedUpdateManyInput = {};
      if (priceForVariants) variantData.price = priceForVariants;
      if (categoryIdForVariants !== undefined) variantData.categoryId = categoryIdForVariants;
      if (descriptionForVariants !== undefined) variantData.description = descriptionForVariants;
      if (body.isActive !== undefined) variantData.isActive = Boolean(body.isActive);

      await tx.product.updateMany({
        where: {
          id: { in: variantIds },
          OR: [{ name: baseName }, { name: { startsWith: `${baseName} —` } }],
        },
        data: variantData,
      });
    }

    return updatedProduct;
  });

  return NextResponse.json({ ok: true, product: updated });
}

export async function DELETE(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const currentProduct = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!currentProduct) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const scope = new URL(req.url).searchParams.get("scope") === "group" ? "group" : "single";
  const baseName = splitProductName(currentProduct.name);

  const targetProducts =
    scope === "group"
      ? await prisma.product.findMany({
          where: {
            OR: [{ name: baseName }, { name: { startsWith: `${baseName} —` } }],
          },
          select: { id: true },
        })
      : [{ id }];

  const targetIds = targetProducts.map((item) => item.id);

  const deactivateTargets = () =>
    prisma.$transaction(
      targetIds.map((productId) =>
        prisma.product.update({
          where: { id: productId },
          data: {
            isActive: false,
            stock: 0,
            promotions: {
              deleteMany: {},
            },
          },
        })
      )
    );

  const orderItems = await prisma.orderItem.count({ where: { productId: { in: targetIds } } });
  if (orderItems > 0) {
    const updatedProducts = await deactivateTargets();
    return NextResponse.json({
      ok: true,
      mode: "deactivated",
      scope,
      products: updatedProducts,
      message:
        scope === "group"
          ? "El producto tiene pedidos asociados. Se desactivaron todas sus variantes para conservar el historial de ventas."
          : "El producto tiene pedidos asociados. Se desactivo para conservar el historial de ventas.",
    });
  }

  try {
    await prisma.$transaction([
      prisma.productImage.deleteMany({ where: { productId: { in: targetIds } } }),
      prisma.product.deleteMany({ where: { id: { in: targetIds } } }),
    ]);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      const updatedProducts = await deactivateTargets();
      return NextResponse.json({
        ok: true,
        mode: "deactivated",
        scope,
        products: updatedProducts,
        message:
          scope === "group"
            ? "El producto tiene pedidos asociados. Se desactivaron todas sus variantes para conservar el historial de ventas."
            : "El producto tiene pedidos asociados. Se desactivo para conservar el historial de ventas.",
      });
    }

    throw error;
  }

  return NextResponse.json({ ok: true, scope });
}
