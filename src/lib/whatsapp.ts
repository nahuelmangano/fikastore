export const DEFAULT_WHATSAPP_MESSAGE = "Hola {nombre}! Te escribimos de Fika Store por tu pedido #{pedido}.";
export const WHATSAPP_MESSAGE_MAX_LENGTH = 2000;

export function formatWhatsappMessage(template: string, name: string, orderNumber: number) {
  return template.replace(/\{(nombre|pedido)\}/g, (_, key: string) =>
    key === "nombre" ? name.trim() || "cliente" : String(orderNumber)
  );
}

export function whatsappHref(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  const number = digits.startsWith("549")
    ? digits
    : digits.startsWith("54")
      ? `549${digits.slice(2).replace(/^0+/, "")}`
      : `549${digits.replace(/^0+/, "")}`;
  const href = `https://wa.me/${number}`;
  return message ? `${href}?text=${encodeURIComponent(message)}` : href;
}
