function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export function orderPaidTemplate(input: {
  customerName: string;
  orderId: string;
  orderNumber?: number;
  total: number;
  items: { name: string; qty: number; unit: number; subtotal: number }[];
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
    <h2 style="margin:0 0 10px;">¡Pago confirmado! ✅</h2>
    <p style="margin:0 0 18px;">Hola ${input.customerName || "👋"}, recibimos tu pago.</p>

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
      Te vamos a avisar cuando despachemos tu pedido.
    </p>
    <p style="margin:10px 0 0;font-size:12px;color:#777;">FikaStore</p>
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
