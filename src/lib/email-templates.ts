function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

function formatDate(value?: Date | string) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textToHtml(value: string) {
  return escapeHtml(value)
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => `<p style="margin:10px 0 0;color:#444;">${line}</p>`)
    .join("");
}

function addressBlock(input?: {
  name?: string;
  addressLine?: string;
  city?: string;
  province?: string;
  zip?: string;
}) {
  if (!input) return "";
  return [
    input.name,
    input.addressLine,
    [input.city, input.province].filter(Boolean).join(", "),
    input.zip ? `CP ${input.zip}` : "",
  ]
    .filter((line) => String(line || "").trim())
    .map((line) => escapeHtml(String(line)))
    .join("<br>");
}

function splitProductName(name: string) {
  const [base, ...rest] = name.split(/\s+—\s+/);
  return {
    baseName: (base || name).trim(),
    variantName: rest.join(" — ").trim(),
  };
}

export function orderPaidTemplate(input: {
  customerName: string;
  orderId: string;
  orderNumber?: number;
  orderDate?: Date | string;
  payment?: {
    provider?: string;
    status?: string;
    method?: string;
    paymentId?: string;
    installments?: number;
    amount?: number;
  };
  shipping?: {
    method?: string | null;
    deliveryType?: string | null;
    branchName?: string | null;
    addressLine?: string;
    city?: string;
    province?: string;
    zip?: string;
    amount?: number;
  };
  billingAddress?: {
    name?: string;
    addressLine?: string;
    city?: string;
    province?: string;
    zip?: string;
  };
  subtotal?: number;
  discount?: number;
  total: number;
  items: { name: string; variantName?: string; qty: number; unit: number; subtotal: number; imageUrl?: string }[];
  message?: string;
}) {
  const orderLabel = input.orderNumber ? `#${input.orderNumber}` : input.orderId;
  const orderDate = formatDate(input.orderDate);
  const subtotal = input.subtotal ?? input.items.reduce((acc, it) => acc + it.subtotal, 0);
  const shippingAmount = input.shipping?.amount ?? 0;
  const discount = Math.max(0, input.discount ?? 0);
  const isPickup = input.shipping?.method === "pickup";
  const isBranchPickup = input.shipping?.deliveryType === "S";
  const deliveryTitle = isPickup || isBranchPickup ? "Retiro" : "Envio";
  const shippingText =
    isPickup
      ? "Retiro en punto de retiro"
      : isBranchPickup
        ? `Retiro en ${input.shipping?.branchName || "sucursal"}`
        : addressBlock({
            addressLine: input.shipping?.addressLine,
            city: input.shipping?.city,
            province: input.shipping?.province,
            zip: input.shipping?.zip,
          });
  const billingText =
    addressBlock(input.billingAddress) ||
    addressBlock({
      name: input.customerName,
      addressLine: input.shipping?.addressLine,
      city: input.shipping?.city,
      province: input.shipping?.province,
      zip: input.shipping?.zip,
    }) ||
    "No informada";
  const paymentMethod = [input.payment?.provider, input.payment?.method].filter(Boolean).join(" · ") || "Mercado Pago";
  const paymentInfo = [
    paymentMethod,
    input.payment?.installments ? `${input.payment.installments} cuota${input.payment.installments === 1 ? "" : "s"}` : "",
    input.payment?.paymentId ? `ID ${input.payment.paymentId}` : "",
  ].filter(Boolean).join(" · ");

  const rows = input.items
    .map(
      (it) => {
        const split = splitProductName(it.name);
        const name = escapeHtml(split.baseName);
        const variant = escapeHtml(it.variantName || split.variantName || "");
        const image = it.imageUrl
          ? `<img src="${escapeHtml(it.imageUrl)}" alt="" width="76" height="96" style="display:block;width:76px;height:96px;object-fit:cover;border-radius:4px;border:1px solid #eee;">`
          : `<div style="width:76px;height:96px;border-radius:4px;border:1px solid #eee;background:#f6f6f6;"></div>`;
        return `
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #eee;width:92px;vertical-align:top;">${image}</td>
            <td style="padding:14px 0;border-bottom:1px solid #eee;vertical-align:top;">
              <div style="font-size:14px;font-weight:700;color:#111;">${name}</div>
              ${variant ? `<div style="margin-top:5px;font-size:12px;color:#777;">Variante: ${variant}</div>` : ""}
              <div style="margin-top:5px;font-size:12px;color:#777;">Cantidad: ${it.qty}</div>
              <div style="margin-top:5px;font-size:12px;color:#777;">Unitario: ${money(it.unit)}</div>
            </td>
            <td style="padding:14px 0;border-bottom:1px solid #eee;text-align:right;vertical-align:top;font-size:14px;font-weight:700;color:#111;white-space:nowrap;">${money(it.subtotal)}</td>
          </tr>
        `;
      }
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111;background:#fff;">
    <div style="padding:28px 24px 20px;">
      <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2;color:#111;">Orden confirmada</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#444;">Hola ${escapeHtml(input.customerName || "Cliente")}, recibimos tu pago y estamos preparando tu pedido.</p>

      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <tr>
          <td style="width:33.33%;vertical-align:top;">
            <div style="font-size:12px;font-weight:700;color:#111;">Orden confirmada</div>
            <div style="margin-top:8px;height:4px;background:#111;border-radius:999px;"></div>
          </td>
          <td style="width:33.33%;vertical-align:top;padding-left:8px;">
            <div style="font-size:12px;font-weight:700;color:#888;">Enviado</div>
            <div style="margin-top:8px;height:4px;background:#ddd;border-radius:999px;"></div>
          </td>
          <td style="width:33.33%;vertical-align:top;padding-left:8px;">
            <div style="font-size:12px;font-weight:700;color:#888;">Entregado</div>
            <div style="margin-top:8px;height:4px;background:#ddd;border-radius:999px;"></div>
          </td>
        </tr>
      </table>

      <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:18px 0;margin-bottom:22px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0 12px 10px 0;vertical-align:top;">
              <div style="font-size:12px;font-weight:700;color:#777;text-transform:uppercase;">Numero de orden</div>
              <div style="margin-top:5px;font-size:15px;font-weight:700;color:#111;">${escapeHtml(orderLabel)}</div>
            </td>
            <td style="padding:0 0 10px 12px;vertical-align:top;">
              <div style="font-size:12px;font-weight:700;color:#777;text-transform:uppercase;">Fecha de orden</div>
              <div style="margin-top:5px;font-size:15px;font-weight:700;color:#111;">${escapeHtml(orderDate || "No informada")}</div>
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom:22px;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#111;">${deliveryTitle}</h2>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#444;">${shippingText || "Retiro en punto de retiro"}</p>
      </div>

      <div style="margin-bottom:22px;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#111;">Direccion de facturacion</h2>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#444;">${billingText}</p>
      </div>

      <div style="margin-bottom:22px;">
        <h2 style="margin:0 0 10px;font-size:16px;color:#111;">Info del pago</h2>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#444;">${escapeHtml(paymentInfo)}</p>
      </div>

      <div style="border-top:1px solid #ddd;padding-top:20px;margin-bottom:22px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#111;">Productos</h2>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
      </div>

      <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:16px 0;margin-bottom:22px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#444;">Subtotal</td>
            <td style="padding:5px 0;text-align:right;font-size:14px;color:#111;">${money(subtotal)}</td>
          </tr>
          ${discount > 0 ? `
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#444;">Descuento</td>
            <td style="padding:5px 0;text-align:right;font-size:14px;color:#111;">-${money(discount)}</td>
          </tr>` : ""}
          <tr>
            <td style="padding:5px 0;font-size:14px;color:#444;">Envio</td>
            <td style="padding:5px 0;text-align:right;font-size:14px;color:#111;">${shippingAmount > 0 ? money(shippingAmount) : "$0"}</td>
          </tr>
        <tr>
            <td style="padding:12px 0 0;font-size:22px;font-weight:800;color:#111;">Total pagado</td>
            <td style="padding:12px 0 0;text-align:right;font-size:22px;font-weight:800;color:#111;">${money(input.total)}</td>
        </tr>
      </table>
    </div>

    <div style="margin-top:18px;">
        ${textToHtml(input.message || "Te vamos a avisar cuando despachemos tu pedido.")}
      </div>
      <p style="margin:14px 0 0;font-size:12px;color:#777;">FikaStore</p>
    </div>
  </div>`;
}

export function orderShippedTemplate(input: {
  customerName: string;
  orderId: string;
  orderNumber?: number;
}) {
  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
    <h2 style="margin:0 0 10px;">¡Tu pedido fue enviado! 📦</h2>
    <p style="margin:0 0 18px;">Hola ${input.customerName || "👋"}, tu pedido ya está en camino.</p>

    <div style="border:1px solid #eee;border-radius:12px;padding:14px;">
      <div style="font-size:12px;color:#666;">Orden</div>
      <div style="font-family:monospace;font-size:13px;margin-top:6px;">
        ${input.orderNumber ? `#${input.orderNumber}` : input.orderId}
      </div>
    </div>

    <p style="margin:18px 0 0;color:#444;">
      Gracias por comprar en FikaStore 💛
    </p>
  </div>`;
}

export function cartAbandonedTemplate(input: {
  customerName: string;
  siteUrl: string;
  items: { name: string; qty: number; unit: number; subtotal: number }[];
  total: number;
}) {
  const rows = input.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${it.name} × ${it.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${money(it.subtotal)}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
    <h2 style="margin:0 0 10px;">Tu carrito te está esperando 🛒</h2>
    <p style="margin:0 0 18px;">Hola ${input.customerName || "👋"}, dejaste productos en tu carrito.</p>

    <div style="border:1px solid #eee;border-radius:12px;padding:14px;">
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
        <tr>
          <td style="padding:10px 0;font-weight:bold;">Total</td>
          <td style="padding:10px 0;font-weight:bold;text-align:right;">${money(input.total)}</td>
        </tr>
      </table>
    </div>

    <p style="margin:18px 0 0;color:#444;">
      Si querés completar tu compra, podés volver a tu carrito.
    </p>
    <p style="margin:14px 0 0;">
      <a href="${input.siteUrl}/cart" style="display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
        Ir al carrito
      </a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#777;">FikaStore</p>
  </div>`;
}

export function pendingPaymentTemplate(input: {
  customerName: string;
  orderId: string;
  orderNumber?: number;
  siteUrl: string;
  items: { name: string; qty: number; unit: number; subtotal: number }[];
  total: number;
}) {
  const rows = input.items
    .map(
      (it) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${it.name} × ${it.qty}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${money(it.subtotal)}</td>
      </tr>`
    )
    .join("");

  return `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
    <h2 style="margin:0 0 10px;">Tu pago quedó pendiente ⏳</h2>
    <p style="margin:0 0 18px;">Hola ${input.customerName || "👋"}, tu pedido aún no se pagó.</p>

    <div style="border:1px solid #eee;border-radius:12px;padding:14px;">
      <div style="font-size:12px;color:#666;">Orden</div>
      <div style="font-family:monospace;font-size:13px;margin:6px 0 12px;">
        ${input.orderNumber ? `#${input.orderNumber}` : input.orderId}
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
        <tr>
          <td style="padding:10px 0;font-weight:bold;">Total</td>
          <td style="padding:10px 0;font-weight:bold;text-align:right;">${money(input.total)}</td>
        </tr>
      </table>
    </div>

    <p style="margin:18px 0 0;color:#444;">
      Podés retomar el pago desde el enlace de tu pedido.
    </p>
    <p style="margin:14px 0 0;">
      <a href="${input.siteUrl}/pay/pending?orderId=${input.orderId}" style="display:inline-block;background:#111;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;">
        Continuar pago
      </a>
    </p>
    <p style="margin:12px 0 0;font-size:12px;color:#777;">FikaStore</p>
  </div>`;
}

export function stockBackInStockTemplate(input: {
  customerName: string;
  productName: string;
  productUrl: string;
  imageUrl?: string;
  message?: string;
}) {
  const customerName = escapeHtml(input.customerName);
  const productName = escapeHtml(input.productName);
  const productUrl = escapeHtml(input.productUrl);
  const image = input.imageUrl
    ? `<img src="${escapeHtml(input.imageUrl)}" alt="" width="120" height="150" style="display:block;width:120px;height:150px;object-fit:cover;border-radius:4px;border:1px solid #eee;">`
    : `<div style="width:120px;height:150px;border-radius:4px;border:1px solid #eee;background:#f6f6f6;"></div>`;

  return `
  <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111;background:#fff;">
    <div style="padding:28px 24px 20px;">
      <h1 style="margin:0 0 8px;font-size:24px;line-height:1.2;color:#111;">Volvió a estar disponible</h1>
      <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#444;">Hola ${customerName || "Cliente"}, el producto que estabas esperando ya tiene stock.</p>

      <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:18px 0;margin-bottom:22px;">
        <h2 style="margin:0 0 12px;font-size:16px;color:#111;">Producto disponible</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="width:138px;vertical-align:top;padding-right:18px;">${image}</td>
            <td style="vertical-align:top;">
              <div style="font-size:16px;font-weight:800;color:#111;line-height:1.35;">${productName}</div>
              <div style="margin-top:8px;font-size:13px;color:#777;">Stock disponible para comprar.</div>
              <p style="margin:16px 0 0;">
                <a href="${productUrl}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;">
                  Ver producto
                </a>
              </p>
            </td>
          </tr>
        </table>
      </div>

      <div style="margin-top:18px;">
        ${textToHtml(input.message || "Ya podés volver a la tienda para verlo y completar tu compra.")}
      </div>
      <p style="margin:14px 0 0;font-size:12px;color:#777;">FikaStore</p>
    </div>
  </div>`;
}
