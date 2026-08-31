import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildVariantCombinationKey,
  buildVariantDraftsFromOptions,
  normalizeProductOptions,
  type ProductOptionInput,
  type ProductVariantInput,
  validateProductVariantOptions,
} from "@/lib/productVariants";

type TxClient = Prisma.TransactionClient;

export async function loadProductVariantConfig(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      options: {
        orderBy: { position: "asc" },
        include: {
          values: {
            orderBy: { position: "asc" },
          },
        },
      },
      variants: {
        orderBy: { createdAt: "asc" },
        include: {
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
}

export async function syncProductVariants(
  tx: TxClient,
  input: {
    productId: string;
    enabled: boolean;
    options: ProductOptionInput[];
    variants: ProductVariantInput[];
  }
) {
  if (!input.enabled) {
    await tx.productVariantValue.deleteMany({
      where: { variant: { productId: input.productId } },
    });
    await tx.productVariant.deleteMany({ where: { productId: input.productId } });
    await tx.productOptionValue.deleteMany({
      where: { option: { productId: input.productId } },
    });
    await tx.productOption.deleteMany({ where: { productId: input.productId } });
    await tx.product.update({
      where: { id: input.productId },
      data: { hasVariants: false },
    });
    return {
      stockTotal: null as number | null,
      combinationCount: 0,
      variants: [] as Array<{ id: string; combinationKey: string; label: string; optionValueIds: string[] }>,
    };
  }

  const normalizedOptions = normalizeProductOptions(input.options);
  const validation = validateProductVariantOptions(normalizedOptions);
  if (!validation.ok) {
    throw new Error(validation.errors[0] || "Configuración de variantes inválida.");
  }

  const existing = await tx.product.findUnique({
    where: { id: input.productId },
    include: {
      options: {
        include: { values: true },
      },
      variants: {
        include: { values: true },
      },
    },
  });
  if (!existing) throw new Error("Producto no encontrado.");

  const keptOptionIds = new Set<string>();
  const optionValueIdsByTempKey = new Map<string, string>();
  const optionNamesByValueTempKey = new Map<string, { optionName: string; value: string }>();

  for (const option of normalizedOptions) {
    const savedOption = option.id
      ? await tx.productOption.update({
          where: { id: option.id },
          data: {
            name: option.name,
            position: option.position,
          },
        })
      : await tx.productOption.create({
          data: {
            productId: input.productId,
            name: option.name,
            position: option.position,
          },
        });

    keptOptionIds.add(savedOption.id);

    const keptValueIds = new Set<string>();
    for (const value of option.values) {
      const savedValue = value.id
        ? await tx.productOptionValue.update({
            where: { id: value.id },
            data: {
              value: value.value,
              position: value.position,
            },
          })
        : await tx.productOptionValue.create({
            data: {
              optionId: savedOption.id,
              value: value.value,
              position: value.position,
            },
          });

      keptValueIds.add(savedValue.id);
      optionValueIdsByTempKey.set(value.tempKey, savedValue.id);
      optionNamesByValueTempKey.set(value.tempKey, { optionName: option.name, value: value.value });
    }

    const currentValueIds = existing.options
      .find((current) => current.id === savedOption.id)
      ?.values.map((value) => value.id) || [];
    const valueIdsToDelete = currentValueIds.filter((id) => !keptValueIds.has(id));
    if (valueIdsToDelete.length > 0) {
      await tx.productVariantValue.deleteMany({ where: { optionValueId: { in: valueIdsToDelete } } });
      await tx.productOptionValue.deleteMany({ where: { id: { in: valueIdsToDelete } } });
    }
  }

  const optionIdsToDelete = existing.options.map((option) => option.id).filter((id) => !keptOptionIds.has(id));
  if (optionIdsToDelete.length > 0) {
    const valueIdsToDelete = existing.options
      .filter((option) => optionIdsToDelete.includes(option.id))
      .flatMap((option) => option.values.map((value) => value.id));
    if (valueIdsToDelete.length > 0) {
      await tx.productVariantValue.deleteMany({ where: { optionValueId: { in: valueIdsToDelete } } });
      await tx.productOptionValue.deleteMany({ where: { id: { in: valueIdsToDelete } } });
    }
    await tx.productOption.deleteMany({ where: { id: { in: optionIdsToDelete } } });
  }

  const generatedDrafts = buildVariantDraftsFromOptions(normalizedOptions, input.variants).map((draft) => {
    const optionValueIds = draft.optionValueKeys.map((key) => optionValueIdsByTempKey.get(key)).filter(Boolean) as string[];
    const combinationKey = buildVariantCombinationKey(optionValueIds);
    const label = draft.optionValueKeys
      .map((key) => optionNamesByValueTempKey.get(key))
      .filter(Boolean)
      .map((item) => `${item!.optionName}: ${item!.value}`)
      .join(" · ");
    return {
      id: draft.id,
      combinationKey,
      label,
      stock: Math.max(0, Math.floor(Number(draft.stock) || 0)),
      sku: draft.sku?.trim() || null,
      priceOverride:
        draft.priceOverride === null || draft.priceOverride === undefined
          ? null
          : Number(draft.priceOverride),
      optionValueIds,
      enabled: draft.enabled !== false,
    };
  });
  const activeDrafts = generatedDrafts.filter((variant) => variant.enabled !== false);

  const seenCombinationKeys = new Set<string>();
  const seenSkus = new Set<string>();
  for (const variant of activeDrafts) {
    if (!variant.combinationKey || variant.optionValueIds.length !== normalizedOptions.length) {
      throw new Error("Hay combinaciones incompletas.");
    }
    if (seenCombinationKeys.has(variant.combinationKey)) {
      throw new Error("Hay combinaciones duplicadas.");
    }
    seenCombinationKeys.add(variant.combinationKey);
    if (variant.sku) {
      const skuKey = variant.sku.toLowerCase();
      if (seenSkus.has(skuKey)) throw new Error("Hay SKU repetidos.");
      seenSkus.add(skuKey);
    }
    if (variant.priceOverride !== null && (!Number.isFinite(variant.priceOverride) || variant.priceOverride < 0)) {
      throw new Error("El precio específico de una variante es inválido.");
    }
  }

  const existingVariantById = new Map(existing.variants.map((variant) => [variant.id, variant]));
  const existingVariantByKey = new Map(existing.variants.map((variant) => [variant.combinationKey, variant]));
  const savedVariantIds = new Set<string>();
  const savedVariants: Array<{ id: string; combinationKey: string; label: string; optionValueIds: string[] }> = [];

  for (const variant of activeDrafts) {
    const skuConflict = variant.sku
      ? await tx.productVariant.findFirst({
          where: {
            sku: variant.sku,
            NOT: variant.id ? { id: variant.id } : undefined,
          },
          select: { id: true },
        })
      : null;
    if (skuConflict) throw new Error(`El SKU "${variant.sku}" ya está en uso.`);

    const target =
      (variant.id ? existingVariantById.get(variant.id) : null) ||
      existingVariantByKey.get(variant.combinationKey) ||
      null;

    const savedVariant = target
      ? await tx.productVariant.update({
          where: { id: target.id },
          data: {
            combinationKey: variant.combinationKey,
            label: variant.label,
            stock: variant.stock,
            sku: variant.sku,
            priceOverride:
              variant.priceOverride === null ? null : new Prisma.Decimal(variant.priceOverride.toFixed(2)),
          },
        })
      : await tx.productVariant.create({
          data: {
            productId: input.productId,
            combinationKey: variant.combinationKey,
            label: variant.label,
            stock: variant.stock,
            sku: variant.sku,
            priceOverride:
              variant.priceOverride === null ? null : new Prisma.Decimal(variant.priceOverride.toFixed(2)),
          },
        });

    savedVariantIds.add(savedVariant.id);
    savedVariants.push({
      id: savedVariant.id,
      combinationKey: savedVariant.combinationKey,
      label: savedVariant.label,
      optionValueIds: variant.optionValueIds,
    });

    await tx.productVariantValue.deleteMany({ where: { variantId: savedVariant.id } });
    if (variant.optionValueIds.length > 0) {
      await tx.productVariantValue.createMany({
        data: variant.optionValueIds.map((optionValueId) => ({
          variantId: savedVariant.id,
          optionValueId,
        })),
      });
    }
  }

  const variantIdsToDelete = existing.variants.map((variant) => variant.id).filter((id) => !savedVariantIds.has(id));
  if (variantIdsToDelete.length > 0) {
    await tx.productVariantValue.deleteMany({ where: { variantId: { in: variantIdsToDelete } } });
    await tx.productVariant.deleteMany({ where: { id: { in: variantIdsToDelete } } });
  }

  const stockTotal = activeDrafts.reduce((acc, variant) => acc + variant.stock, 0);
  await tx.product.update({
    where: { id: input.productId },
    data: {
      hasVariants: true,
      stock: stockTotal,
    },
  });

  return { stockTotal, combinationCount: activeDrafts.length, variants: savedVariants };
}
