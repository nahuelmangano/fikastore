export function parseOrderArchiveRequest(body: unknown): { orderIds: string[]; archived: boolean } {
  if (!body || typeof body !== "object") throw new Error("Solicitud inválida.");
  const { orderIds, archived } = body as { orderIds?: unknown; archived?: unknown };
  if (typeof archived !== "boolean") throw new Error("Indicá si querés archivar o restaurar los pedidos.");
  if (!Array.isArray(orderIds) || !orderIds.length || orderIds.length > 100) {
    throw new Error("Seleccioná entre 1 y 100 pedidos.");
  }
  if (orderIds.some((id) => typeof id !== "string" || !id.trim() || id.length > 200)) {
    throw new Error("La selección contiene pedidos inválidos.");
  }
  return { orderIds: [...new Set(orderIds.map((id: string) => id.trim()))], archived };
}
