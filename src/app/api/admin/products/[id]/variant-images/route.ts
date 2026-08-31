import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

type AssignmentInput = {
  variantId?: string;
  combinationKey?: string;
  imageIds?: string[];
};

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

  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      hasVariants: true,
      variants: {
        select: { id: true, combinationKey: true },
      },
    },
  });
  if (!product) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });
  if (!product.hasVariants) {
    return NextResponse.json({ ok: false, error: "Este producto no usa variantes modernas." }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const assignments = Array.isArray(body.assignments) ? (body.assignments as AssignmentInput[]) : [];
  const variantsById = new Map(product.variants.map((variant) => [variant.id, variant.id]));
  const variantsByKey = new Map(product.variants.map((variant) => [variant.combinationKey, variant.id]));
  const allImageIds = Array.from(
    new Set(
      assignments.flatMap((assignment) =>
        Array.isArray(assignment.imageIds)
          ? assignment.imageIds.map((imageId) => String(imageId || "").trim()).filter(Boolean)
          : []
      )
    )
  );

  const invalidAssignment = assignments.find((assignment) => {
    const variantId = String(assignment.variantId || "").trim();
    const combinationKey = String(assignment.combinationKey || "").trim();
    if (variantId) return !variantsById.has(variantId);
    if (combinationKey) return !variantsByKey.has(combinationKey);
    return true;
  });
  if (invalidAssignment) {
    return NextResponse.json({ ok: false, error: "Hay variantes inválidas en la asignación de imágenes." }, { status: 400 });
  }

  if (allImageIds.length > 0) {
    const validImages = await prisma.productImage.findMany({
      where: { productId: id, id: { in: allImageIds } },
      select: { id: true },
    });
    if (validImages.length !== allImageIds.length) {
      return NextResponse.json({ ok: false, error: "Hay imágenes que no pertenecen a este producto." }, { status: 400 });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.productVariantImage.deleteMany({
      where: {
        variant: {
          productId: id,
        },
      },
    });

    const rows = assignments.flatMap((assignment) => {
      const directVariantId = String(assignment.variantId || "").trim();
      const combinationKey = String(assignment.combinationKey || "").trim();
      const variantId = directVariantId || variantsByKey.get(combinationKey);
      if (!variantId) return [];
      const imageIds = Array.from(
        new Set(
          (Array.isArray(assignment.imageIds) ? assignment.imageIds : [])
            .map((imageId) => String(imageId || "").trim())
            .filter(Boolean)
        )
      );
      return imageIds.map((imageId, index) => ({
        variantId,
        imageId,
        sortOrder: index,
      }));
    });

    if (rows.length > 0) {
      await tx.productVariantImage.createMany({
        data: rows,
      });
    }
  });

  return NextResponse.json({ ok: true });
}
