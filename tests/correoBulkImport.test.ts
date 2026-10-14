import assert from "node:assert/strict";
import test from "node:test";
import { correoSelectionDisabledReason, importCorreoSelection, type CorreoSelectableOrder, type CorreoBulkResult } from "../src/lib/correoBulkImport";

const order: CorreoSelectableOrder = { id: "order-1", orderNumber: 2177, status: "paid", shippingMethod: "correo", correoShipment: null };

test("only selects paid or shipped Correo orders that are not imported or importing", () => {
  assert.equal(correoSelectionDisabledReason(order), null);
  assert.equal(correoSelectionDisabledReason({ ...order, status: "shipped" }), null);
  for (const status of ["pending_payment", "cancelled", "refunded", "delivered"]) {
    assert.ok(correoSelectionDisabledReason({ ...order, status }));
  }
  assert.ok(correoSelectionDisabledReason({ ...order, shippingMethod: "pickup" }));
  assert.ok(correoSelectionDisabledReason({ ...order, correoShipment: { status: "IMPORTED" } }));
  assert.ok(correoSelectionDisabledReason({ ...order, correoShipment: { status: "IMPORTING" } }));
  assert.equal(correoSelectionDisabledReason({ ...order, correoShipment: { status: "ERROR" } }), null);
});

test("continues after API and network failures and reports each order in sequence", async () => {
  const orders = Array.from({ length: 4 }, (_, index) => ({ ...order, id: `order-${index}`, orderNumber: 2177 + index }));
  const calls: string[] = [];
  const results: CorreoBulkResult[] = [];
  const request: typeof fetch = async (url, options) => {
    assert.equal(options?.method, "POST");
    assert.equal(calls.length, results.length, "waits for previous order result before the next request");
    calls.push(String(url));
    if (calls.length === 2) return Response.json({ ok: false, details: "Dirección inválida" }, { status: 400 });
    if (calls.length === 3) throw new Error("Sin conexión");
    return Response.json({ ok: true, reused: calls.length === 4 });
  };
  await importCorreoSelection(orders, (result) => results.push(result), request);
  assert.equal(calls.length, 4);
  assert.deepEqual(results.map((result) => result.ok), [true, false, false, true]);
  assert.equal(results[1].message, "Dirección inválida");
  assert.equal(results[2].message, "Sin conexión");
  assert.equal(results[3].message, "Ya estaba importado.");
  assert.deepEqual(results.map((result) => result.id), orders.map((item) => item.id));
});

test("invalid API response does not stop the remaining imports", async () => {
  let count = 0;
  const results: CorreoBulkResult[] = [];
  await importCorreoSelection([order, { ...order, id: "order-2" }], (result) => results.push(result), async () => {
    count++;
    return count === 1 ? new Response("Bad Gateway", { status: 502 }) : Response.json({ ok: true });
  });
  assert.deepEqual(results.map((result) => result.ok), [false, true]);
});
