import { Prisma } from "@prisma/client";

type OrderAmount = Prisma.Decimal | string | number;

type MercadoPagoOrderItemsInput = {
  total: OrderAmount;
  shippingAmount: OrderAmount;
  items: {
    nameSnapshot: string;
    unitPrice: OrderAmount;
    quantity: number;
    productId: string;
    productVariantId?: string | null;
  }[];
};

export function buildMercadoPagoOrderItems(order: MercadoPagoOrderItemsInput) {
  const items = order.items.map((item) => ({
    title: item.nameSnapshot,
    unit_price: new Prisma.Decimal(item.unitPrice).toFixed(2),
    quantity: item.quantity,
    external_code: item.productVariantId || item.productId,
    description: item.nameSnapshot,
    category_id: "fashion",
  }));

  const shipping = new Prisma.Decimal(order.shippingAmount);
  if (shipping.isNegative()) throw new Error("Invalid shipping amount");
  if (shipping.greaterThan(0)) {
    items.push({
      title: "Envío",
      unit_price: shipping.toFixed(2),
      quantity: 1,
      external_code: "shipping",
      description: "Costo de envío del pedido",
      category_id: "services",
    });
  }

  // Validate the exact amounts serialized to Orders API, including shipping.
  const itemsTotal = items.reduce(
    (sum, item) => sum.add(new Prisma.Decimal(item.unit_price).mul(item.quantity)),
    new Prisma.Decimal(0),
  );
  if (!itemsTotal.equals(new Prisma.Decimal(order.total))) {
    throw new Error("Order items total does not match order total");
  }

  return items;
}

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
