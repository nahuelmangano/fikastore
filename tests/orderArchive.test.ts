import assert from "node:assert/strict";
import test from "node:test";
import { parseOrderArchiveRequest } from "../src/lib/orderArchive";

test("accepts archiving and restoring selections, trims and deduplicates ids", () => {
  assert.deepEqual(parseOrderArchiveRequest({ orderIds: [" order-1 ", "order-1", "order-2"], archived: true }), {
    orderIds: ["order-1", "order-2"], archived: true,
  });
  assert.deepEqual(parseOrderArchiveRequest({ orderIds: ["order-1"], archived: false }), { orderIds: ["order-1"], archived: false });
});

test("rejects malformed selections and non-boolean archive actions", () => {
  for (const body of [null, {}, { orderIds: [], archived: true }, { orderIds: "all", archived: true }, { orderIds: [1], archived: true }, { orderIds: [" "], archived: true }, { orderIds: ["order-1"], archived: "false" }, { orderIds: ["x".repeat(201)], archived: true }]) {
    assert.throws(() => parseOrderArchiveRequest(body));
  }
});

test("limits bulk updates to 100 explicit orders", () => {
  assert.equal(parseOrderArchiveRequest({ orderIds: Array.from({ length: 100 }, (_, index) => `order-${index}`), archived: true }).orderIds.length, 100);
  assert.throws(() => parseOrderArchiveRequest({ orderIds: Array.from({ length: 101 }, (_, index) => `order-${index}`), archived: true }));
});
