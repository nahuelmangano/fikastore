import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { getCustomDomainOrigin } from "@/lib/customDomain";
import { isPrivateOrLocalHost, publicBaseUrl } from "@/lib/publicUrl";
import { DEFAULT_SITE_TITLE, getMailingSettings } from "@/lib/storeSettings";
import { getOrderContactEmail } from "@/lib/orderAccess";
import { resolveNotificationEmail } from "@/lib/notificationEmail";
import { absoluteImageUrl, emailProductRowsHtml } from "@/lib/emailProductRows";

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

function formatDate(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    unknown: "Sin confirmar",
  };
  return map[String(status || "").toLowerCase()] || status || "Sin pago";
}

function shippingMethodLabel(input: {
  shippingMethod?: string | null;
  shippingDeliveryType?: string | null;
  shippingBranchName?: string | null;
}) {
  if (input.shippingMethod === "epick") return "E-Pick";
  if (input.shippingMethod === "andreani") return "Andreani";
  if (input.shippingMethod === "correo") {
    return input.shippingDeliveryType === "S"
      ? `Correo Argentino - Sucursal${input.shippingBranchName ? ` (${input.shippingBranchName})` : ""}`
      : "Correo Argentino - Domicilio";
  }
  if (input.shippingMethod === "pickup") return "Retiro en tienda";
  if (input.shippingMethod === "custom-acordar-envio") return "Punto de Retiro";
  return input.shippingMethod || "No informado";
}

function linesHtml(lines: Array<string | null | undefined>) {
  return lines
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .map((line) => `<div style="margin:0 0 5px;">${escapeHtml(line)}</div>`)
    .join("");
}

function infoBox(title: string, body: string) {
  return `
    <div style="border:1px solid #ddd;background:#fafafa;padding:14px 16px;margin:0 0 18px;color:#444;line-height:1.55;">
      <div style="margin:0 0 10px;font-weight:700;color:#111;text-align:left;">${escapeHtml(title)}</div>
      ${body || `<div>${escapeHtml("No informado")}</div>`}
    </div>
  `;
}

export function merchantOrderNotificationEmail(input: {
  storeName?: string;
  trigger: "created" | "paid";
  orderNumber: string | number;
  orderDate?: Date | string | null;
  customerName: string;
  customerDni?: string | null;
  customerEmail: string;
  customerPhone: string;
  paymentLabel: string;
  paymentStatus?: string | null;
  paymentId?: string | null;
  subtotal?: number;
  shippingAmount?: number;
  total: number;
  items: { name: string; variantSnapshot?: string | null; quantity: number; unitPrice?: number; subtotal: number; imageUrl?: string | null }[];
  shippingMethod?: string | null;
  shippingDeliveryType?: string | null;
  shippingBranchName?: string | null;
  shippingAddressLine?: string | null;
  shippingFloor?: string | null;
  shippingApartment?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingZip?: string | null;
  adminOrderUrl?: string | null;
}) {
  const storeName = input.storeName || DEFAULT_SITE_TITLE;
  const title = input.trigger === "paid" ? "Pago acreditado" : "Nuevo pedido";
  const subtitle =
    input.trigger === "paid"
      ? "Se acreditó un pago y el pedido quedó confirmado."
      : "Se creó un pedido nuevo con pago pendiente/manual.";
  const subjectPrefix = input.trigger === "paid" ? "Pago confirmado" : "Nuevo pedido";
  const shippingLabel = shippingMethodLabel(input);
  const subtotal = input.subtotal ?? input.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const shippingAmount = Number(input.shippingAmount || 0);
  const paymentStatus = input.paymentStatus || (input.trigger === "paid" ? "approved" : "pending");
  const addressExtra = [input.shippingFloor ? `Piso ${input.shippingFloor}` : "", input.shippingApartment ? `Depto ${input.shippingApartment}` : ""]
    .filter(Boolean)
    .join(" · ");
  const itemsHtml = emailProductRowsHtml(
    input.items.map((item) => ({
      name: item.variantSnapshot ? `${item.name} (${item.variantSnapshot})` : item.name,
      imageUrl: item.imageUrl,
      details: [`Cantidad: ${item.quantity}`, item.unitPrice !== undefined ? `Unitario: ${money(Number(item.unitPrice))}` : ""],
      amount: money(Number(item.subtotal)),
    }))
  );
  const itemText = input.items
    .map((item) => `${item.name}${item.variantSnapshot ? ` (${item.variantSnapshot})` : ""} x${item.quantity} - ${money(Number(item.subtotal))}`)
    .join("\n");

  return {
    subject: `${storeName} · ${subjectPrefix} #${input.orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#111;background:#fff;">
        <div style="padding:28px 24px;">
          <div style="font-size:13px;color:#777;margin-bottom:18px;">${escapeHtml(storeName)}</div>
          <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:#111;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 18px;color:#444;">${escapeHtml(subtitle)}</p>
          <div style="border:1px solid #ddd;background:#fafafa;padding:14px 16px;margin:0 0 18px;">
            <div style="margin:0 0 6px;"><strong>Pedido:</strong> #${escapeHtml(String(input.orderNumber))}</div>
            ${input.orderDate ? `<div style="margin:0 0 6px;"><strong>Fecha:</strong> ${escapeHtml(formatDate(input.orderDate))}</div>` : ""}
            <div style="margin:0 0 6px;"><strong>Cliente:</strong> ${escapeHtml(input.customerName)}</div>
            <div style="margin:0 0 6px;"><strong>Email:</strong> ${escapeHtml(input.customerEmail)}</div>
            <div style="margin:0 0 6px;"><strong>Teléfono:</strong> ${escapeHtml(input.customerPhone)}</div>
            ${input.customerDni ? `<div style="margin:0 0 6px;"><strong>DNI:</strong> ${escapeHtml(input.customerDni)}</div>` : ""}
            <div style="margin:0 0 6px;"><strong>Pago:</strong> ${escapeHtml(input.paymentLabel)}</div>
            <div style="margin:0 0 6px;"><strong>Estado:</strong> ${escapeHtml(input.trigger === "paid" ? "Pagado" : "Pendiente de pago")}</div>
            <div style="margin:0;"><strong>Total:</strong> ${escapeHtml(money(Number(input.total)))}</div>
          </div>

          <div style="margin:0 0 18px;text-align:center;">
            <div style="margin:0 0 14px;">
              <div style="font-size:15px;color:#111;">Método de pago:</div>
              <div style="font-size:13px;color:#444;">${escapeHtml(input.paymentLabel)}</div>
            </div>
            <div style="margin:0 0 14px;">
              <div style="font-size:15px;color:#111;">Estado del pago:</div>
              <div style="font-size:13px;color:#444;">${escapeHtml(paymentStatusLabel(paymentStatus))}</div>
            </div>
            ${
              input.paymentId
                ? `
            <div style="margin:0 0 14px;">
              <div style="font-size:15px;color:#111;">ID del pago:</div>
              <div style="font-size:13px;color:#444;">${escapeHtml(input.paymentId)}</div>
            </div>
            `
                : ""
            }
            <div>
              <div style="font-size:15px;color:#111;">Método de envío:</div>
              <div style="font-size:13px;color:#444;">${escapeHtml(shippingLabel)}</div>
            </div>
          </div>

          <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:14px 0;margin:14px 0;">
            <div style="font-weight:700;margin:0 0 10px;">Detalle de la venta</div>
            ${itemsHtml}
            <div style="padding-top:12px;text-align:right;color:#555;">Subtotal: ${escapeHtml(money(subtotal))}</div>
            <div style="padding-top:6px;text-align:right;color:#555;">Envío: ${shippingAmount > 0 ? escapeHtml(money(shippingAmount)) : "Gratis"}</div>
            <div style="padding-top:10px;text-align:right;font-size:16px;font-weight:800;color:#111;">Total: ${escapeHtml(money(Number(input.total)))}</div>
          </div>

          <div style="font-size:16px;color:#111;text-align:center;margin:22px 0 10px;">Datos de envío:</div>
          ${infoBox(
            "Información del método de envío",
            linesHtml([
              `Método de envío: ${shippingLabel}`,
              input.shippingBranchName ? `Punto/Sucursal: ${input.shippingBranchName}` : "",
              input.shippingAddressLine,
              [input.shippingCity, input.shippingProvince].filter(Boolean).join(", "),
              input.shippingZip ? `Código postal: ${input.shippingZip}` : "",
            ])
          )}
          ${infoBox(
            "Información del destinatario",
            linesHtml([
              `Nombre: ${input.customerName}`,
              input.customerEmail ? `Email: ${input.customerEmail}` : "",
              input.customerPhone ? `Teléfono: ${input.customerPhone}` : "",
              input.customerDni ? `DNI: ${input.customerDni}` : "",
              input.shippingAddressLine ? `Calle: ${input.shippingAddressLine}` : "",
              addressExtra,
              input.shippingCity ? `Ciudad: ${input.shippingCity}` : "",
              input.shippingProvince ? `Provincia: ${input.shippingProvince}` : "",
              input.shippingZip ? `Código postal: ${input.shippingZip}` : "",
            ])
          )}

          <div style="font-size:16px;color:#111;text-align:center;margin:22px 0 10px;">Datos para la facturación:</div>
          ${infoBox(
            "",
            linesHtml([
              `Nombre completo: ${input.customerName}`,
              input.customerEmail ? `Email: ${input.customerEmail}` : "",
              input.customerPhone ? `Teléfono: ${input.customerPhone}` : "",
              input.customerDni ? `DNI: ${input.customerDni}` : "",
              input.shippingAddressLine ? `Calle: ${input.shippingAddressLine}` : "",
              addressExtra,
              input.shippingCity ? `Ciudad: ${input.shippingCity}` : "",
              input.shippingProvince ? `Provincia: ${input.shippingProvince}` : "",
              input.shippingZip ? `Código postal: ${input.shippingZip}` : "",
            ])
          )}

          ${
            input.adminOrderUrl
              ? `
          <p style="margin:18px 0 0;">
            <a href="${escapeHtml(input.adminOrderUrl)}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">
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
      `Pedido: #${input.orderNumber}`,
      ...(input.orderDate ? [`Fecha: ${formatDate(input.orderDate)}`] : []),
      `Cliente: ${input.customerName}`,
      `Email: ${input.customerEmail}`,
      `Teléfono: ${input.customerPhone}`,
      ...(input.customerDni ? [`DNI: ${input.customerDni}`] : []),
      `Pago: ${input.paymentLabel}`,
      `Estado del pago: ${paymentStatusLabel(paymentStatus)}`,
      ...(input.paymentId ? [`ID del pago: ${input.paymentId}`] : []),
      `Método de envío: ${shippingLabel}`,
      `Total: ${money(Number(input.total))}`,
      "Detalle de la venta:",
      itemText,
      `Subtotal: ${money(subtotal)}`,
      `Envío: ${shippingAmount > 0 ? money(shippingAmount) : "Gratis"}`,
      "Datos de envío:",
      `${shippingLabel}`,
      [input.shippingAddressLine, input.shippingCity, input.shippingProvince, input.shippingZip].filter(Boolean).join(", "),
      "Datos para la facturación:",
      [input.customerName, input.customerEmail, input.customerPhone, input.customerDni || ""].filter(Boolean).join(" · "),
      ...(input.adminOrderUrl ? [`Admin: ${input.adminOrderUrl}`] : []),
    ].join("\n"),
  };
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
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        items: {
          include: {
            product: {
              select: {
                images: {
                  where: { visible: true },
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        },
      },
    }),
    getMailingSettings(),
  ]);

  if (!order) return;

  const to = resolveNotificationEmail(mailing);
  if (!to) return;

  const baseUrl = await resolveMerchantBaseUrl(input.req);
  const imageBaseUrl = baseUrl || publicBaseUrl(input.req);
  const adminOrderUrl = baseUrl ? `${baseUrl}/admin/orders/${order.id}` : null;
  const customerEmail = getOrderContactEmail(order) || "Sin email";
  const payment = order.payments[0];
  const subtotal = order.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const email = merchantOrderNotificationEmail({
    storeName: DEFAULT_SITE_TITLE,
    trigger: input.trigger,
    orderNumber: order.orderNumber ?? order.id,
    orderDate: order.createdAt,
    customerName: order.shippingName || order.user?.name || "Cliente",
    customerDni: order.dni,
    customerEmail,
    customerPhone: order.shippingPhone || "-",
    paymentLabel: input.paymentLabel,
    paymentStatus: payment?.status,
    paymentId: payment?.paymentId,
    subtotal,
    shippingAmount: Number(order.shippingAmount),
    total: Number(order.total),
    items: order.items.map((item) => ({
      name: item.nameSnapshot,
      variantSnapshot: item.variantSnapshot,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      subtotal: Number(item.subtotal),
      imageUrl: absoluteImageUrl(imageBaseUrl, item.product.images[0]?.url),
    })),
    shippingMethod: order.shippingMethod,
    shippingDeliveryType: order.shippingDeliveryType,
    shippingBranchName: order.shippingBranchName,
    shippingAddressLine: order.shippingAddressLine,
    shippingFloor: order.shippingFloor,
    shippingApartment: order.shippingApartment,
    shippingCity: order.shippingCity,
    shippingProvince: order.shippingProvince,
    shippingZip: order.shippingZip,
    adminOrderUrl,
  });

  await sendMail({
    to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
