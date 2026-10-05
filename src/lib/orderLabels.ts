const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pendiente de pago",
  paid: "Pagado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
  unknown: "Desconocido",
};

export function orderStatusLabel(status?: string | null) {
  if (!status) return "Sin estado";
  return ORDER_STATUS_LABELS[status] || status.replaceAll("_", " ");
}

export function paymentStatusLabel(status?: string | null) {
  if (!status) return "Sin estado";
  return PAYMENT_STATUS_LABELS[status] || status.replaceAll("_", " ");
}
