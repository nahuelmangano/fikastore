import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ui";
import { getAutomaticDiscountsForProducts } from "@/lib/promotions";

export default async function ProductDetailPage({
  params,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams?.slug?.trim();
  if (!slug) return notFound();

  const product = await prisma.product.findUnique({
    where: { slug },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!product || !product.isActive) return notFound();
  const promoMap = await getAutomaticDiscountsForProducts([product.id]);
  const promoPercent = promoMap.get(product.id) ?? 0;

  return <ProductDetailClient product={product as any} promoPercent={promoPercent} />;
}
