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

  const activeVariants = sortVariantsBySize(variants.length > 0 ? variants : [product]);
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
