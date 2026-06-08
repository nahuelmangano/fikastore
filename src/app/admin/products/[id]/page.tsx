import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AdminProductEditor from "./ui";

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
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
    include: { images: { orderBy: { sortOrder: "asc" } }, category: true },
  });

  if (!product) return notFound();

  const { baseName } = splitProductName(product.name);
  const variants = await prisma.product.findMany({
    where: {
      OR: [{ name: baseName }, { name: { startsWith: `${baseName} —` } }],
    },
    include: { images: { orderBy: { sortOrder: "asc" } }, category: true },
    orderBy: [{ name: "asc" }],
  });

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <AdminProductEditor
      product={product}
      variants={variants.length > 0 ? variants : [product]}
      categories={categories}
    />
  );
}
