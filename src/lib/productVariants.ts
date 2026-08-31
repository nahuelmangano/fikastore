export const PRODUCT_VARIANT_LIMITS = {
  maxOptions: 3,
  maxValuesPerOption: 20,
  maxCombinations: 200,
} as const;

export type ProductOptionValueInput = {
  id?: string;
  clientKey?: string;
  value: string;
};

export type ProductOptionInput = {
  id?: string;
  clientKey?: string;
  name: string;
  values: ProductOptionValueInput[];
};

export type ProductVariantInput = {
  id?: string;
  stock: number;
  sku?: string | null;
  priceOverride?: number | null;
  optionValueIds?: string[];
  optionValueKeys?: string[];
  enabled?: boolean;
};

export type ProductVariantSelectionInput = {
  optionId: string;
  optionName: string;
  optionValueId: string;
  optionValueValue: string;
};

export type NormalizedProductOptionValue = {
  id?: string;
  tempKey: string;
  value: string;
  normalizedValue: string;
  position: number;
};

export type NormalizedProductOption = {
  id?: string;
  tempKey: string;
  name: string;
  normalizedName: string;
  position: number;
  values: NormalizedProductOptionValue[];
};

export type NormalizedProductVariantDraft = {
  id?: string;
  combinationKey: string;
  label: string;
  stock: number;
  sku: string | null;
  priceOverride: number | null;
  optionValueKeys: string[];
  enabled: boolean;
};

function collapseWhitespace(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCase(value: string) {
  return collapseWhitespace(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeOptionName(value: string) {
  return collapseWhitespace(value);
}

export function normalizeOptionValue(value: string) {
  return collapseWhitespace(value);
}

export function normalizeOptionNameKey(value: string) {
  return normalizeCase(value);
}

export function normalizeOptionValueKey(value: string) {
  return normalizeCase(value);
}

function optionTempKey(option: ProductOptionInput, index: number) {
  return option.id?.trim() || option.clientKey?.trim() || `option:${index}`;
}

function valueTempKey(optionKey: string, value: ProductOptionValueInput, index: number) {
  return value.id?.trim() || value.clientKey?.trim() || `${optionKey}:value:${index}`;
}

export function normalizeProductOptions(rawOptions: ProductOptionInput[]) {
  return rawOptions.map((option, optionIndex) => {
    const name = normalizeOptionName(option.name);
    const tempKey = optionTempKey(option, optionIndex);
    return {
      id: option.id?.trim() || undefined,
      tempKey,
      name,
      normalizedName: normalizeOptionNameKey(name),
      position: optionIndex,
      values: option.values.map((value, valueIndex) => {
        const cleanValue = normalizeOptionValue(value.value);
        return {
          id: value.id?.trim() || undefined,
          tempKey: valueTempKey(tempKey, value, valueIndex),
          value: cleanValue,
          normalizedValue: normalizeOptionValueKey(cleanValue),
          position: valueIndex,
        };
      }),
    };
  });
}

export function buildVariantCombinationKey(optionValueKeys: string[]) {
  return [...optionValueKeys].sort().join("|");
}

export function buildVariantLabel(
  selections: Array<{ optionName: string; optionValue: string }>
) {
  return selections.map((selection) => `${selection.optionName}: ${selection.optionValue}`).join(" · ");
}

export function cartesianProduct<T>(groups: T[][]): T[][] {
  if (groups.length === 0) return [];
  return groups.reduce<T[][]>(
    (acc, group) => acc.flatMap((prefix) => group.map((item) => [...prefix, item])),
    [[]]
  );
}

export function buildVariantDraftsFromOptions(
  options: NormalizedProductOption[],
  existingVariants: ProductVariantInput[] = []
): NormalizedProductVariantDraft[] {
  if (options.length === 0 || options.some((option) => option.values.length === 0)) return [];

  const combinations = cartesianProduct(options.map((option) => option.values));
  const existingByKey = new Map(
    existingVariants
      .map((variant) => {
        const keys = Array.isArray(variant.optionValueKeys) ? variant.optionValueKeys.filter(Boolean) : [];
        const combinationKey = buildVariantCombinationKey(keys);
        return combinationKey
          ? [
              combinationKey,
              {
                id: variant.id?.trim() || undefined,
                stock: Math.max(0, Math.floor(Number(variant.stock) || 0)),
                sku: collapseWhitespace(String(variant.sku || "")) || null,
                priceOverride:
                  variant.priceOverride === null || variant.priceOverride === undefined
                    ? null
                    : Number(variant.priceOverride),
                enabled: variant.enabled !== false,
              },
            ]
          : null;
      })
      .filter(Boolean) as Array<[string, { id?: string; stock: number; sku: string | null; priceOverride: number | null; enabled: boolean }]>
  );

  return combinations.map((combination) => {
    const optionValueKeys = combination.map((item) => item.tempKey);
    const combinationKey = buildVariantCombinationKey(optionValueKeys);
    const existing = existingByKey.get(combinationKey);
    return {
      id: existing?.id,
      combinationKey,
      label: buildVariantLabel(
        combination.map((item) => {
          const option = options.find((candidate) => candidate.values.some((value) => value.tempKey === item.tempKey));
          return {
            optionName: option?.name || "",
            optionValue: item.value,
          };
        })
      ),
      stock: existing?.stock ?? 0,
      sku: existing?.sku ?? null,
      priceOverride:
        existing?.priceOverride !== null && existing?.priceOverride !== undefined && Number.isFinite(existing.priceOverride)
          ? existing.priceOverride
          : null,
      optionValueKeys,
      enabled: existing?.enabled ?? true,
    };
  });
}

export function validateProductVariantOptions(options: NormalizedProductOption[]) {
  const errors: string[] = [];

  if (options.length > PRODUCT_VARIANT_LIMITS.maxOptions) {
    errors.push(`Podés usar hasta ${PRODUCT_VARIANT_LIMITS.maxOptions} opciones.`);
  }

  const seenOptionNames = new Set<string>();
  for (const option of options) {
    if (!option.name) errors.push("Cada opción debe tener nombre.");
    if (option.normalizedName) {
      if (seenOptionNames.has(option.normalizedName)) {
        errors.push(`La opción "${option.name}" está repetida.`);
      }
      seenOptionNames.add(option.normalizedName);
    }
    if (option.values.length === 0) {
      errors.push(`La opción "${option.name || "sin nombre"}" debe tener al menos un valor.`);
    }
    if (option.values.length > PRODUCT_VARIANT_LIMITS.maxValuesPerOption) {
      errors.push(`La opción "${option.name}" supera el máximo de ${PRODUCT_VARIANT_LIMITS.maxValuesPerOption} valores.`);
    }
    const seenValues = new Set<string>();
    for (const value of option.values) {
      if (!value.value) errors.push(`La opción "${option.name || "sin nombre"}" tiene un valor vacío.`);
      if (value.normalizedValue) {
        if (seenValues.has(value.normalizedValue)) {
          errors.push(`La opción "${option.name}" tiene valores repetidos.`);
        }
        seenValues.add(value.normalizedValue);
      }
    }
  }

  const combinations = options.reduce((acc, option) => acc * Math.max(1, option.values.length), 1);
  if (options.length > 0 && combinations > PRODUCT_VARIANT_LIMITS.maxCombinations) {
    errors.push(`Las combinaciones superan el máximo de ${PRODUCT_VARIANT_LIMITS.maxCombinations}.`);
  }

  return {
    ok: errors.length === 0,
    errors,
    combinationCount: options.length > 0 ? combinations : 0,
  };
}

export function lineItemKey(productId: string, productVariantId?: string | null) {
  return `${productId}:${productVariantId || ""}`;
}
