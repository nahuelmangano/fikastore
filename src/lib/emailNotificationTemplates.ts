export type EmailTemplateKey =
  | "payment-approved"
  | "payment-rejected"
  | "payment-pending"
  | "payment-pending-reminder"
  | "review-request"
  | "birthday-coupon"
  | "return-confirmation"
  | "refund-completed"
  | "back-in-stock"
  | "order-shipped"
  | "cart-abandoned";

export type EmailTemplateDefault = {
  key: EmailTemplateKey;
  name: string;
  category: string;
  subject: string;
  html: string;
  text: string;
  variables: string[];
  enabled: boolean;
};

function layout(title: string, body: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111;background:#fff;">
      <div style="padding:28px 24px 20px;">
        <div style="font-size:13px;color:#777;margin-bottom:18px;">{{storeName}}</div>
        <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:#111;">${title}</h1>
        ${body}
        <p style="margin:22px 0 0;font-size:12px;color:#777;">
          {{storeName}} · <a href="{{storeUrl}}" style="color:#111;">{{storeUrl}}</a>
        </p>
      </div>
    </div>
  `;
}

export const EMAIL_TEMPLATE_DEFAULTS: EmailTemplateDefault[] = [
  {
    key: "payment-approved",
    name: "Pago aprobado",
    category: "Pagos",
    subject: "{{storeName}} · Pago confirmado",
    enabled: true,
    variables: ["customerName", "orderNumber", "orderUrl", "storeName", "storeUrl"],
    html: layout(
      "Orden confirmada",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, recibimos el pago de tu pedido {{orderNumber}}.</p>
       <p style="margin:18px 0 0;"><a href="{{orderUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Ver pedido</a></p>`
    ),
    text: "Hola {{customerName}}, recibimos el pago de tu pedido {{orderNumber}}. Ver pedido: {{orderUrl}}",
  },
  {
    key: "payment-rejected",
    name: "Pago rechazado",
    category: "Pagos",
    subject: "{{storeName}} · No pudimos aprobar tu pago",
    enabled: true,
    variables: ["customerName", "orderNumber", "paymentAmount", "paymentMethod", "paymentStatus", "rejectionReason", "retryPaymentUrl", "storeName", "storeUrl", "supportEmail"],
    html: layout(
      "No pudimos aprobar tu pago",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, el pago del pedido {{orderNumber}} fue rechazado.</p>
       <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:16px 0;margin-bottom:18px;">
         <p style="margin:0 0 8px;color:#444;">Importe: <strong>{{paymentAmount}}</strong></p>
         <p style="margin:0 0 8px;color:#444;">Medio: <strong>{{paymentMethod}}</strong></p>
         <p style="margin:0 0 8px;color:#444;">Estado: <strong>{{paymentStatus}}</strong></p>
         <p style="margin:0;color:#444;">Motivo: <strong>{{rejectionReason}}</strong></p>
       </div>
       <p style="margin:18px 0 0;"><a href="{{retryPaymentUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Reintentar pago</a></p>
       <p style="margin:14px 0 0;color:#555;">También podés contactarnos en {{supportEmail}}.</p>`
    ),
    text: "Hola {{customerName}}, el pago del pedido {{orderNumber}} fue rechazado. Importe: {{paymentAmount}}. Medio: {{paymentMethod}}. Estado: {{paymentStatus}}. Motivo: {{rejectionReason}}. Reintentar: {{retryPaymentUrl}}. Contacto: {{supportEmail}}",
  },
  {
    key: "payment-pending",
    name: "Pago pendiente",
    category: "Pagos",
    subject: "{{storeName}} · Tu pago está pendiente",
    enabled: true,
    variables: ["customerName", "orderNumber", "paymentAmount", "paymentMethod", "paymentInstructions", "paymentDueDate", "paymentUrl", "storeName", "storeUrl"],
    html: layout(
      "Tu pago está pendiente",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, creamos tu pedido {{orderNumber}} y el pago está pendiente.</p>
       <p style="margin:0 0 8px;color:#444;">Importe total: <strong>{{paymentAmount}}</strong></p>
       <p style="margin:0 0 8px;color:#444;">Medio de pago: <strong>{{paymentMethod}}</strong></p>
       <p style="margin:0 0 8px;color:#444;">{{paymentInstructions}}</p>
       <p style="margin:0;color:#444;">Fecha límite: {{paymentDueDate}}</p>
       <p style="margin:18px 0 0;"><a href="{{paymentUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Completar pago</a></p>`
    ),
    text: "Hola {{customerName}}, tu pedido {{orderNumber}} está pendiente. Total: {{paymentAmount}}. Medio: {{paymentMethod}}. {{paymentInstructions}} Fecha límite: {{paymentDueDate}}. Completar: {{paymentUrl}}",
  },
  {
    key: "payment-pending-reminder",
    name: "Recordatorio de pago pendiente",
    category: "Pagos",
    subject: "{{storeName}} · Recordatorio de pago pendiente",
    enabled: true,
    variables: ["customerName", "orderNumber", "paymentAmount", "reminderNumber", "paymentUrl", "storeName", "storeUrl"],
    html: layout(
      "Tu pago sigue pendiente",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, este es el recordatorio {{reminderNumber}} para completar el pago del pedido {{orderNumber}}.</p>
       <p style="margin:0;color:#444;">Importe total: <strong>{{paymentAmount}}</strong></p>
       <p style="margin:18px 0 0;"><a href="{{paymentUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Completar pago</a></p>`
    ),
    text: "Recordatorio {{reminderNumber}}. El pago del pedido {{orderNumber}} sigue pendiente por {{paymentAmount}}. Completar: {{paymentUrl}}",
  },
  {
    key: "review-request",
    name: "Solicitud de opinión",
    category: "Clientes",
    subject: "{{storeName}} · ¿Cómo fue tu compra?",
    enabled: true,
    variables: ["customerName", "orderNumber", "productsHtml", "orderUrl", "storeName", "storeUrl"],
    html: layout(
      "Queremos conocer tu opinión",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, esperamos que estés disfrutando tu pedido {{orderNumber}}.</p>
       <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:14px 0;">{{{productsHtml}}}</div>
       <p style="margin:18px 0 0;"><a href="{{orderUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Ver pedido</a></p>`
    ),
    text: "Hola {{customerName}}, nos gustaría conocer tu opinión sobre el pedido {{orderNumber}}. Ver pedido: {{orderUrl}}",
  },
  {
    key: "birthday-coupon",
    name: "Cupón de cumpleaños",
    category: "Clientes",
    subject: "{{storeName}} · Tu regalo de cumpleaños",
    enabled: true,
    variables: ["customerName", "couponCode", "discount", "expiresAt", "storeName", "storeUrl"],
    html: layout(
      "Tu regalo de cumpleaños",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, te dejamos un cupón especial para tu cumpleaños.</p>
       <div style="border:1px solid #ddd;border-radius:8px;padding:16px;font-size:22px;font-weight:800;text-align:center;">{{couponCode}}</div>
       <p style="margin:16px 0 0;color:#444;">Descuento: {{discount}} · Vence: {{expiresAt}}</p>`
    ),
    text: "Hola {{customerName}}, tu cupón de cumpleaños es {{couponCode}}. Descuento: {{discount}}. Vence: {{expiresAt}}.",
  },
  {
    key: "return-confirmation",
    name: "Confirmación de devolución",
    category: "Devoluciones",
    subject: "{{storeName}} · Devolución {{returnCode}}",
    enabled: true,
    variables: ["customerName", "orderNumber", "returnCode", "returnStatus", "itemsHtml", "nextSteps", "returnInstructions", "storeName", "storeUrl"],
    html: layout(
      "Devolución registrada",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, registramos la devolución {{returnCode}} del pedido {{orderNumber}}.</p>
       <p style="margin:0 0 8px;color:#444;">Estado actual: <strong>{{returnStatus}}</strong></p>
       <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:14px 0;margin:14px 0;">{{{itemsHtml}}}</div>
       <p style="margin:0 0 8px;color:#444;">{{nextSteps}}</p>
       <p style="margin:0;color:#444;">{{returnInstructions}}</p>`
    ),
    text: "Registramos la devolución {{returnCode}} del pedido {{orderNumber}}. Estado: {{returnStatus}}. {{nextSteps}} {{returnInstructions}}",
  },
  {
    key: "refund-completed",
    name: "Reembolso realizado",
    category: "Reembolsos",
    subject: "{{storeName}} · Reembolso confirmado",
    enabled: true,
    variables: ["customerName", "orderNumber", "refundAmount", "paymentMethod", "refundId", "refundDate", "estimatedAccreditation", "storeName", "storeUrl"],
    html: layout(
      "Reembolso confirmado",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, confirmamos el reembolso del pedido {{orderNumber}}.</p>
       <p style="margin:0 0 8px;color:#444;">Importe reembolsado: <strong>{{refundAmount}}</strong></p>
       <p style="margin:0 0 8px;color:#444;">Medio original: {{paymentMethod}}</p>
       <p style="margin:0 0 8px;color:#444;">Identificador: {{refundId}}</p>
       <p style="margin:0 0 8px;color:#444;">Fecha: {{refundDate}}</p>
       <p style="margin:0;color:#444;">{{estimatedAccreditation}} Los tiempos finales dependen del banco o medio de pago.</p>`
    ),
    text: "Reembolso confirmado para pedido {{orderNumber}}. Importe: {{refundAmount}}. Medio: {{paymentMethod}}. ID: {{refundId}}. Fecha: {{refundDate}}. {{estimatedAccreditation}}",
  },
  {
    key: "back-in-stock",
    name: "Vuelta de stock",
    category: "Productos",
    subject: "{{storeName}} · {{productName}} volvió a estar disponible",
    enabled: true,
    variables: ["customerName", "productName", "productUrl", "storeName", "storeUrl"],
    html: layout(
      "Volvió a estar disponible",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, {{productName}} ya tiene stock.</p>
       <p style="margin:18px 0 0;"><a href="{{productUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Ver producto</a></p>`
    ),
    text: "Hola {{customerName}}, {{productName}} volvió a estar disponible. Ver: {{productUrl}}",
  },
  {
    key: "order-shipped",
    name: "Pedido enviado",
    category: "Pedidos",
    subject: "{{storeName}} · Tu pedido fue enviado",
    enabled: true,
    variables: ["customerName", "orderNumber", "orderUrl", "storeName", "storeUrl"],
    html: layout("Tu pedido fue enviado", `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, tu pedido {{orderNumber}} ya está en camino.</p><p><a href="{{orderUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Ver pedido</a></p>`),
    text: "Hola {{customerName}}, tu pedido {{orderNumber}} fue enviado. Ver pedido: {{orderUrl}}",
  },
  {
    key: "cart-abandoned",
    name: "Carrito abandonado",
    category: "Clientes",
    subject: "{{storeName}} · Tenés productos en tu carrito",
    enabled: true,
    variables: ["customerName", "cartItemsHtml", "cartItemsText", "cartUrl", "storeName", "storeUrl"],
    html: layout(
      "Tu carrito te está esperando",
      `<p style="margin:0 0 18px;color:#444;">Hola {{customerName}}, dejaste productos en tu carrito.</p>
       <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:14px 0;margin:14px 0;">{{{cartItemsHtml}}}</div>
       <p style="margin:18px 0 0;"><a href="{{cartUrl}}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Ir al carrito</a></p>`
    ),
    text: "Hola {{customerName}}, dejaste productos en tu carrito. Productos: {{cartItemsText}} Volver: {{cartUrl}}",
  },
];

export function getDefaultTemplate(key: string) {
  return EMAIL_TEMPLATE_DEFAULTS.find((template) => template.key === key);
}
