import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";
import { notFound } from "next/navigation";
import AdminProductEditor from "./ui";
import type { Prisma } from "@prisma/client";

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

function variantSizeRank(name: string) {
  const match = name.match(/talle(?:\s+\w+)?\s*:\s*(?:pijama\s*)?(XXL|XL|XS|S|M|L)\b/i);
  const size = match?.[1]?.toUpperCase();
  const index = size ? SIZE_ORDER.indexOf(size) : -1;
  return index >= 0 ? index : SIZE_ORDER.length;
}

function sortVariantsBySize<T extends { name: string }>(variants: T[]) {
  return [...variants].sort((a, b) => {
    const rankDiff = variantSizeRank(a.name) - variantSizeRank(b.name);
    return rankDiff || a.name.localeCompare(b.name);
  });
}

type ProductForEditor = Prisma.ProductGetPayload<{
  include: { images: true; category: true };
}>;

function toEditorProduct(product: ProductForEditor) {
  return {
    id: product.id,
    categoryId: product.categoryId,
    category: product.category ? { id: product.category.id, name: product.category.name } : null,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    stock: product.stock,
    isActive: product.isActive,
    images: product.images.map((image) => ({
      id: image.id,
      productId: image.productId,
      url: image.url,
      sortOrder: image.sortOrder,
    })),
  };
}

export default async function AdminProductEditPage({
  params,
}: {
  params: { id?: string } | Promise<{ id?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return notFound();

  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }, category: true },
  });

  if (!product) return notFound();

  const { baseName } = splitProductName(product.name);
  const variants = await prisma.product.findMany({
    where: {
      OR: [{ name: baseName }, { name: { startsWith: `${baseName} —` } }],
    },
    include: { images: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }, category: true },
    orderBy: [{ name: "asc" }],
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, parentId: true, name: true, slug: true },
  });

  return (
    <AdminProductEditor
      product={toEditorProduct(product)}
      variants={sortVariantsBySize(variants.length > 0 ? variants : [product]).map(toEditorProduct)}
      categories={flattenCategories(categories)}
    />
  );
}
