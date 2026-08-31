import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { getCustomDomainOrigin } from "@/lib/customDomain";
import { isPrivateOrLocalHost, publicBaseUrl } from "@/lib/publicUrl";
import { DEFAULT_SITE_TITLE, getMailingSettings } from "@/lib/storeSettings";
import { getOrderContactEmail } from "@/lib/orderAccess";
import { resolveNotificationEmail } from "@/lib/notificationEmail";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

async function resolveMerchantBaseUrl(req?: Request) {
  const customDomainOrigin = await getCustomDomainOrigin();
  if (customDomainOrigin) return customDomainOrigin;

  const fallbackBaseUrl = publicBaseUrl(req);

  try {
    const parsed = new URL(fallbackBaseUrl);
    if (!isPrivateOrLocalHost(parsed.hostname)) {
      return parsed.origin.replace(/\/$/, "");
    }
  } catch {}

  return null;
}

export async function sendMerchantOrderNotification(input: {
  orderId: string;
  trigger: "created" | "paid";
  paymentLabel: string;
  req?: Request;
}) {
  const [order, mailing] = await Promise.all([
    prisma.order.findUnique({
      where: { id: input.orderId },
      include: {
        user: { select: { email: true, name: true } },
        items: true,
      },
    }),
    getMailingSettings(),
  ]);

  if (!order) return;

  const to = resolveNotificationEmail(mailing);
  if (!to) return;

  const baseUrl = await resolveMerchantBaseUrl(input.req);
  const adminOrderUrl = baseUrl ? `${baseUrl}/admin/orders/${order.id}` : null;
  const customerEmail = getOrderContactEmail(order) || "Sin email";
  const itemLines = order.items.map((item) => {
    const variant = item.variantSnapshot ? ` (${item.variantSnapshot})` : "";
    return `<li style="margin:0 0 6px;">${escapeHtml(item.nameSnapshot)}${variant} x${item.quantity} · ${escapeHtml(money(Number(item.subtotal)))}</li>`;
  });
  const itemText = order.items
    .map((item) => `${item.nameSnapshot}${item.variantSnapshot ? ` (${item.variantSnapshot})` : ""} x${item.quantity} - ${money(Number(item.subtotal))}`)
    .join("\n");

  const title = input.trigger === "paid" ? "Pago acreditado" : "Nuevo pedido";
  const subtitle =
    input.trigger === "paid"
      ? "Se acreditó un pago y el pedido quedó confirmado."
      : "Se creó un pedido nuevo con pago pendiente/manual.";
  const subjectPrefix = input.trigger === "paid" ? "Pago confirmado" : "Nuevo pedido";
  const storeName = DEFAULT_SITE_TITLE;

  await sendMail({
    to,
    subject: `${storeName} · ${subjectPrefix} #${order.orderNumber ?? order.id}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111;background:#fff;">
        <div style="padding:28px 24px;">
          <div style="font-size:13px;color:#777;margin-bottom:18px;">${escapeHtml(storeName)}</div>
          <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:#111;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 18px;color:#444;">${escapeHtml(subtitle)}</p>
          <div style="border:1px solid #ddd;padding:14px 16px;margin:0 0 18px;">
            <div style="margin:0 0 6px;"><strong>Pedido:</strong> #${escapeHtml(String(order.orderNumber ?? order.id))}</div>
            <div style="margin:0 0 6px;"><strong>Cliente:</strong> ${escapeHtml(order.shippingName || order.user?.name || "Cliente")}</div>
            <div style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(customerEmail)}</div>
            <div style="margin:0 0 6px;"><strong>Teléfono:</strong> ${escapeHtml(order.shippingPhone || "-")}</div>
            <div style="margin:0 0 6px;"><strong>Pago:</strong> ${escapeHtml(input.paymentLabel)}</div>
            <div style="margin:0 0 6px;"><strong>Estado:</strong> ${escapeHtml(input.trigger === "paid" ? "Pagado" : "Pendiente de pago")}</div>
            <div style="margin:0;"><strong>Total:</strong> ${escapeHtml(money(Number(order.total)))}</div>
          </div>
          <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:14px 0;margin:14px 0;">
            <div style="font-weight:700;margin:0 0 10px;">Productos</div>
            <ul style="margin:0;padding-left:18px;color:#444;line-height:1.6;">
              ${itemLines.join("")}
            </ul>
          </div>
          <div style="border:1px solid #ddd;padding:14px 16px;margin:0 0 18px;color:#444;line-height:1.6;">
            <div><strong>Envío:</strong> ${escapeHtml(order.shippingMethod || "No informado")}</div>
            <div>${escapeHtml(order.shippingAddressLine)}</div>
            <div>${escapeHtml([order.shippingCity, order.shippingProvince].filter(Boolean).join(", "))}</div>
            <div>${escapeHtml(order.shippingZip || "")}</div>
          </div>
          ${
            adminOrderUrl
              ? `
          <p style="margin:18px 0 0;">
            <a href="${escapeHtml(adminOrderUrl)}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">
              Ver pedido en admin
            </a>
          </p>
          `
              : ""
          }
        </div>
      </div>
    `,
    text: [
      `${storeName}`,
      `${title}`,
      subtitle,
      `Pedido: #${order.orderNumber ?? order.id}`,
      `Cliente: ${order.shippingName || order.user?.name || "Cliente"}`,
      `Email: ${customerEmail}`,
      `Teléfono: ${order.shippingPhone || "-"}`,
      `Pago: ${input.paymentLabel}`,
      `Estado: ${input.trigger === "paid" ? "Pagado" : "Pendiente de pago"}`,
      `Total: ${money(Number(order.total))}`,
      "Productos:",
      itemText,
      ...(adminOrderUrl ? [`Admin: ${adminOrderUrl}`] : []),
    ].join("\n"),
  });
}
