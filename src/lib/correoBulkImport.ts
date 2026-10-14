export type CorreoSelectableOrder = {
  id: string;
  orderNumber: number;
  status: string;
  shippingMethod: string | null;
  correoShipment: { status: string } | null;
};

export function correoSelectionDisabledReason(order: CorreoSelectableOrder): string | null {
  if (order.shippingMethod !== "correo") return "El pedido no usa Correo Argentino.";
  if (order.status !== "paid" && order.status !== "shipped") return "El pedido debe estar pagado o enviado.";
  if (order.correoShipment?.status === "IMPORTED") return "El pedido ya está importado.";
  if (order.correoShipment?.status === "IMPORTING") return "El pedido se está importando.";
  return null;
}

export type CorreoBulkResult = {
  id: string;
  orderNumber: number;
  ok: boolean;
  message: string;
};

export async function importCorreoSelection(
  orders: CorreoSelectableOrder[],
  onResult: (result: CorreoBulkResult) => void,
  request: typeof fetch = fetch
) {
  for (const order of orders) {
    let result: CorreoBulkResult;
    try {
      const response = await request(`/api/admin/orders/${encodeURIComponent(order.id)}/correo/import`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.details || data.error || "No se pudo importar el envío.");
      result = { id: order.id, orderNumber: order.orderNumber, ok: true, message: data.reused ? "Ya estaba importado." : "Importado correctamente." };
    } catch (error) {
      result = { id: order.id, orderNumber: order.orderNumber, ok: false, message: error instanceof Error ? error.message : "No se pudo importar el envío." };
    }
    onResult(result);
  }
}
