import assert from "node:assert/strict";
import test from "node:test";
import { buildMercadoPagoOrderItems, buildMercadoPagoOrderShipment } from "../src/lib/mercadoPagoOrderPayload";

const product = (price: string, quantity = 1) => ({
  nameSnapshot: "Producto",
  unitPrice: price,
  quantity,
  productId: "product-1",
});

test("order 2181 includes paid shipping so items match the payment amount", () => {
  const items = buildMercadoPagoOrderItems({
    total: "126846.00",
    shippingAmount: "12646.00",
    items: [product("54300.00"), product("59900.00")],
  });
  assert.equal(items.length, 3);
  assert.equal(items[2].title, "Envío");
  assert.equal(items[2].unit_price, "12646.00");
  assert.equal(items[2].quantity, 1);
  assert.equal(items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0), 126846);
});

test("order 2171 with free shipping keeps only product items", () => {
  const items = buildMercadoPagoOrderItems({
    total: "54300.00",
    shippingAmount: "0",
    items: [product("54300.00")],
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].unit_price, "54300.00");
});

test("validates quantities and decimal amounts without floating point drift", () => {
  const items = buildMercadoPagoOrderItems({
    total: "0.70",
    shippingAmount: "0.10",
    items: [product("0.20", 3)],
  });
  assert.equal(items[0].quantity, 3);
  assert.equal(items[1].unit_price, "0.10");
});

test("refuses inconsistent totals and negative shipping before requesting payment", () => {
  assert.throws(() => buildMercadoPagoOrderItems({
    total: "120",
    shippingAmount: "10",
    items: [product("100")],
  }), /does not match/);
  assert.throws(() => buildMercadoPagoOrderItems({
    total: "90",
    shippingAmount: "-10",
    items: [product("100")],
  }), /Invalid shipping/);
});

test("includes shipment address when order has a complete shipping address", () => {
  assert.deepEqual(buildMercadoPagoOrderShipment({
    shippingZip: " C1264AAK ",
    shippingProvince: " CABA ",
    shippingCity: " Buenos Aires ",
    shippingAddressLine: " Av. Test 123 ",
  }), {
    shipment: {
      address: {
        zip_code: "C1264AAK",
        state: "CABA",
        city: "Buenos Aires",
        street_name: "Av. Test 123",
      },
    },
  });
});

test("omits shipment when required address fields are incomplete", () => {
  assert.deepEqual(buildMercadoPagoOrderShipment({
    shippingZip: "",
    shippingProvince: "Buenos Aires",
    shippingCity: "La Plata",
    shippingAddressLine: "Calle 1",
  }), {});

  assert.deepEqual(buildMercadoPagoOrderShipment({
    shippingZip: "1900",
    shippingProvince: "",
    shippingCity: "La Plata",
    shippingAddressLine: "Calle 1",
  }), {});

  assert.deepEqual(buildMercadoPagoOrderShipment({
    shippingZip: "1900",
    shippingProvince: "B",
    shippingCity: "La Plata",
    shippingAddressLine: "Calle 1",
  }), {});

  assert.deepEqual(buildMercadoPagoOrderShipment({
    shippingZip: "1900",
    shippingProvince: "Buenos Aires",
    shippingCity: "",
    shippingAddressLine: "Calle 1",
  }), {});
});

test("omits shipment when shipping address is absent", () => {
  assert.deepEqual(buildMercadoPagoOrderShipment({}), {});
});

test("does not invent street name when optional street line is absent", () => {
  assert.deepEqual(buildMercadoPagoOrderShipment({
    shippingZip: "1900",
    shippingProvince: "Buenos Aires",
    shippingCity: "La Plata",
    shippingAddressLine: "",
  }), {
    shipment: {
      address: {
        zip_code: "1900",
        state: "Buenos Aires",
        city: "La Plata",
      },
    },
  });
});
