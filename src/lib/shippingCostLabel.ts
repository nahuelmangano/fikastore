export function shippingCostLabel(amount: unknown, pricingMode?: string) {
  const value = Number(amount || 0);
  if (value > 0) return `$${value.toLocaleString("es-AR")}`;
  return pricingMode === "agreement" ? "A convenir" : "Gratis";
}
