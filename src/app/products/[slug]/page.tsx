import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ui";
import { getAutomaticDiscountsForProducts } from "@/lib/promotions";

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
}

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

  const { baseName } = splitProductName(product.name);
  const variants = await prisma.product.findMany({
    where: {
      isActive: true,
      OR: [{ name: baseName }, { name: { startsWith: `${baseName} —` } }],
    },
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: [{ name: "asc" }],
  });

  const activeVariants = variants.length > 0 ? variants : [product];
  const promoMap = await getAutomaticDiscountsForProducts(activeVariants.map((variant) => variant.id));
  const promoPercent = promoMap.get(product.id) ?? 0;

  return (
    <ProductDetailClient
      product={product}
      variants={activeVariants}
      promoPercent={promoPercent}
      promoPercents={Object.fromEntries(promoMap)}
    />
  );
}
