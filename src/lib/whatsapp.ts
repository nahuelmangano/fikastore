export function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("549")) return `https://wa.me/${digits}`;
  if (digits.startsWith("54")) return `https://wa.me/549${digits.slice(2).replace(/^0+/, "")}`;

  const nationalNumber = digits.replace(/^0+/, "");
  return `https://wa.me/549${nationalNumber}`;
}
