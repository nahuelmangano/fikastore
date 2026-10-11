import assert from "node:assert/strict";
import test from "node:test";
import { buildMercadoPagoOrderShipment } from "../src/lib/mercadoPagoOrderPayload";

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
