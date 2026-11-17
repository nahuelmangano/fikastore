import assert from "node:assert/strict";
import test from "node:test";
import { syncProductVariants } from "../src/lib/productVariantPersistence";
import { buildVariantDraftsFromOptions, normalizeProductOptions } from "../src/lib/productVariants";

const options = [{
  id: "color",
  name: "Color",
  values: [{ id: "chocolate", value: "Chocolate" }, { id: "crema", value: "Crema" }],
}];

function fixture(existing = true) {
  type Row = {
    id: string;
    combinationKey: string;
    label: string;
    stock: number;
    isActive: boolean;
    values: { optionValueId: string }[];
  };
  const rows: Row[] = existing ? [{
    id: "variant-chocolate",
    combinationKey: "chocolate",
    label: "Color: Chocolate",
    stock: 5,
    isActive: true,
    values: [{ optionValueId: "chocolate" }],
  }] : [];
  let stock = 0;
  const deletedImageFilters: unknown[] = [];
  const tx = {
    product: {
      findUnique: async () => ({ options, variants: structuredClone(rows) }),
      update: async ({ data }: { data: { stock: number } }) => { stock = data.stock; },
    },
    productOption: {
      update: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
    },
    productOptionValue: {
      update: async ({ where }: { where: { id: string } }) => ({ id: where.id }),
    },
    productVariant: {
      findFirst: async () => null,
      findMany: async () => rows.map((row) => ({ id: row.id, _count: { orderItems: 0 } })),
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
        const row = rows.find((row) => row.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
      create: async ({ data }: { data: Omit<Row, "id" | "values"> }) => {
        const row = { ...data, id: `variant-${data.combinationKey}`, values: [] };
        rows.push(row);
        return row;
      },
      deleteMany: async () => { throw new Error("Configured combinations must not be deleted"); },
    },
    productVariantValue: {
      deleteMany: async ({ where }: { where: { variantId: string } }) => {
        rows.find((row) => row.id === where.variantId)!.values = [];
      },
      createMany: async ({ data }: { data: { variantId: string; optionValueId: string }[] }) => {
        for (const value of data) rows.find((row) => row.id === value.variantId)!.values.push({ optionValueId: value.optionValueId });
      },
    },
    productVariantImage: {
      deleteMany: async (filter: unknown) => { deletedImageFilters.push(filter); },
    },
  };
  return {
    tx: tx as unknown as Parameters<typeof syncProductVariants>[0],
    rows,
    deletedImageFilters,
    stock: () => stock,
  };
}

for (const existing of [true, false]) {
  test(`disabled combinations survive save, reload and reactivation (${existing ? "existing" : "new"} variant)`, async () => {
    const db = fixture(existing);
    const input = {
      productId: "product",
      enabled: true,
      options,
      variants: [
        { optionValueKeys: ["chocolate"], stock: 5, enabled: false },
        { optionValueKeys: ["crema"], stock: 2, enabled: true },
      ],
    };
    const saved = await syncProductVariants(db.tx, input);
    const disabled = db.rows.find((row) => row.combinationKey === "chocolate")!;
    assert.equal(disabled.isActive, false);
    assert.equal(disabled.stock, 5);
    assert.deepEqual(disabled.values, [{ optionValueId: "chocolate" }]);
    assert.equal(db.stock(), 2);
    // Image assignment responses still contain only active combinations.
    assert.deepEqual(saved.variants.map((row) => row.combinationKey), ["crema"]);
    assert.deepEqual(db.deletedImageFilters, []);

    const reloaded = buildVariantDraftsFromOptions(normalizeProductOptions(options), db.rows.map((row) => ({
      id: row.id,
      stock: row.stock,
      enabled: row.isActive,
      optionValueKeys: row.values.map((value) => value.optionValueId),
    })));
    assert.equal(reloaded.find((row) => row.combinationKey === "chocolate")!.enabled, false);
    const disabledId = disabled.id;
    await syncProductVariants(db.tx, { ...input, variants: reloaded });
    assert.equal(disabled.isActive, false);

    await syncProductVariants(db.tx, {
      ...input,
      variants: reloaded.map((row) => ({ ...row, enabled: true })),
    });
    assert.equal(db.rows.find((row) => row.id === disabledId)!.isActive, true);
    assert.equal(db.rows.length, 2);
    assert.equal(db.stock(), 7);
  });
}
