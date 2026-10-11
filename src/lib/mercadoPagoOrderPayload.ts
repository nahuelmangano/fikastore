type MercadoPagoShipmentInput = {
  shippingZip?: string | null;
  shippingProvince?: string | null;
  shippingCity?: string | null;
  shippingAddressLine?: string | null;
};

type MercadoPagoShipment = {
  shipment: {
    address: {
      zip_code: string;
      state: string;
      city: string;
      street_name?: string;
    };
  };
};

function cleanText(value: string | null | undefined) {
  return String(value || "").trim();
}

export function buildMercadoPagoOrderShipment(input: MercadoPagoShipmentInput): MercadoPagoShipment | Record<string, never> {
  const zipCode = cleanText(input.shippingZip);
  const state = cleanText(input.shippingProvince);
  const city = cleanText(input.shippingCity);
  const streetName = cleanText(input.shippingAddressLine);

  if (zipCode.length < 1 || state.length < 2 || city.length < 1) {
    return {};
  }

  return {
    shipment: {
      address: {
        zip_code: zipCode,
        state,
        city,
        ...(streetName ? { street_name: streetName } : {}),
      },
    },
  };
}
