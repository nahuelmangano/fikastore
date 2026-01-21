import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ui";

export default async function ProductDetailPage({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({
    where: { slug: params.slug },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!product || !product.isActive) return notFound();

  return <ProductDetailClient product={product as any} />;
}
