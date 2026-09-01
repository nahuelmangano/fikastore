import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ui";
import { getAutomaticDiscountsForProducts } from "@/lib/promotions";
import StoreTemporarilyClosed from "@/components/StoreTemporarilyClosed";
import { getCheckoutPaymentSettings, getTemporaryShutdownSettings } from "@/lib/storeSettings";

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
  searchParams,
}: {
  params: { slug?: string } | Promise<{ slug?: string }>;
  searchParams?: { variant?: string } | Promise<{ variant?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const slug = resolvedParams?.slug?.trim();
  const initialVariantId = String(resolvedSearchParams?.variant || "").trim() || null;
  if (!slug) return notFound();

  const temporaryShutdown = await getTemporaryShutdownSettings();
  if (temporaryShutdown.isShutdown) {
    return <StoreTemporarilyClosed message={temporaryShutdown.message} />;
  }

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      images: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      options: {
        orderBy: { position: "asc" },
        include: {
          values: { orderBy: { position: "asc" } },
        },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        include: {
          images: {
            orderBy: [{ sortOrder: "asc" }, { imageId: "asc" }],
            include: {
              image: true,
            },
          },
          values: {
            include: {
              optionValue: {
                include: {
                  option: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!product || !product.isActive) return notFound();

  const { baseName } = splitProductName(product.name);
  const legacyVariants = product.hasVariants
    ? []
    : await prisma.product.findMany({
        where: {
          isActive: true,
          OR: [{ name: baseName }, { name: { startsWith: `${baseName} —` } }],
        },
        include: { images: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
        orderBy: [{ name: "asc" }],
      });

  const activeVariants = sortVariantsBySize(legacyVariants.length > 0 ? legacyVariants : [product]);
  const discountTargetIds = product.hasVariants ? [product.id] : activeVariants.map((variant) => variant.id);
  const [paymentSettings, cashPromoMap, transferPromoMap, mercadoPagoPromoMap, agreementPromoMap] = await Promise.all([
    getCheckoutPaymentSettings(),
    getAutomaticDiscountsForProducts(discountTargetIds, "cash"),
    getAutomaticDiscountsForProducts(discountTargetIds, "transfer"),
    getAutomaticDiscountsForProducts(discountTargetIds, "mercadopago"),
    getAutomaticDiscountsForProducts(discountTargetIds, "agreement"),
  ]);
  const promoMap = new Map(
    discountTargetIds.map((id) => [
      id,
      Math.max(
        cashPromoMap.get(id) ?? 0,
        transferPromoMap.get(id) ?? 0,
        mercadoPagoPromoMap.get(id) ?? 0,
        agreementPromoMap.get(id) ?? 0
      ),
    ])
  );
  const promoPercent = promoMap.get(product.id) ?? 0;

  return (
    <ProductDetailClient
      product={product}
      variants={product.hasVariants ? [product] : activeVariants}
      modernVariantOptions={product.options.map((option) => ({
        id: option.id,
        name: option.name,
        values: option.values.map((value) => ({
          id: value.id,
          value: value.value,
        })),
      }))}
      modernVariants={product.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        sku: variant.sku,
        stock: variant.stock,
        priceOverride: variant.priceOverride ? Number(variant.priceOverride) : null,
        optionValueIds: variant.values.map((value) => value.optionValueId),
        imageUrls: variant.images
          .map((item) => (item.image.visible ? item.image.url : null))
          .filter(Boolean) as string[],
        }))}
      initialModernVariantId={initialVariantId}
      promoPercent={promoPercent}
      promoPercents={Object.fromEntries(product.hasVariants ? [[product.id, promoPercent]] : promoMap)}
      promoPercentsByPaymentMethod={{
        cash: Object.fromEntries(cashPromoMap),
        transfer: Object.fromEntries(transferPromoMap),
        mercadopago: Object.fromEntries(mercadoPagoPromoMap),
        agreement: Object.fromEntries(agreementPromoMap),
      }}
      paymentSettings={paymentSettings}
    />
  );
}
