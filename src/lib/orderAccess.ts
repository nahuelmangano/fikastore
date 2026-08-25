export function normalizeOrderEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function getOrderContactEmail(order: {
  contactEmail?: string | null;
  user?: { email?: string | null } | null;
}) {
  return normalizeOrderEmail(order.contactEmail || order.user?.email || "");
}

export function getOrderCustomerName(order: {
  shippingName?: string | null;
  contactEmail?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
}) {
  return order.user?.name || order.shippingName || order.contactEmail || order.user?.email || "Cliente";
}

export function buildPublicOrderUrl(
  baseUrl: string,
  order: {
    id: string;
    contactEmail?: string | null;
    user?: { email?: string | null } | null;
  }
) {
  const url = new URL("/pedido", baseUrl);
  url.searchParams.set("orderId", order.id);
  const email = getOrderContactEmail(order);
  if (email) {
    url.searchParams.set("email", email);
  }
  return url.toString();
}
