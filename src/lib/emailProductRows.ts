type EmailProductRow = {
  name: string;
  imageUrl?: string | null;
  amount?: string;
  details?: string[];
  linkHtml?: string;
};

type EmailOrderItem = {
  nameSnapshot: string;
  quantity: number;
  unitPrice: unknown;
  subtotal: unknown;
  product?: {
    images?: { url?: string | null }[];
  } | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function absoluteImageUrl(baseUrl: string, value?: string | null) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

export function emailProductRowsHtml(rows: EmailProductRow[], options?: { totalHtml?: string }) {
  if (rows.length === 0) return "<p style=\"margin:0;color:#555;\">No hay productos para mostrar.</p>";

  const body = rows
    .map((row) => {
      const image = row.imageUrl
        ? `<img src="${escapeHtml(row.imageUrl)}" alt="" width="76" height="96" style="display:block;width:76px;max-width:76px;height:96px;max-height:96px;object-fit:cover;border-radius:4px;border:1px solid #eee;">`
        : `<div style="width:76px;max-width:76px;height:96px;border-radius:4px;border:1px solid #eee;background:#f6f6f6;"></div>`;
      const details = (row.details || [])
        .filter((detail) => detail.trim())
        .map((detail) => `<div style="margin-top:5px;font-size:12px;color:#777;">${escapeHtml(detail)}</div>`)
        .join("");

      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-bottom:1px solid #eee;border-collapse:collapse;">
          <tr>
            <td width="88" valign="top" style="width:88px;padding:14px 12px 14px 0;">
              ${image}
            </td>
            <td valign="top" style="padding:14px 12px 14px 0;">
              <div style="font-size:14px;line-height:18px;font-weight:700;color:#111;">${escapeHtml(row.name)}</div>
              ${details}
              ${row.linkHtml || ""}
            </td>
            ${row.amount ? `<td width="92" valign="top" align="right" style="width:92px;padding:14px 0;font-size:14px;line-height:18px;font-weight:700;color:#111;white-space:nowrap;">${escapeHtml(row.amount)}</td>` : ""}
          </tr>
        </table>
      `;
    })
    .join("");

  return `${body}${options?.totalHtml || ""}`;
}

function money(value: unknown) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`;
}

function emailTotalsHtml(options: { subtotal?: unknown; shipping?: unknown; total?: unknown }) {
  const rows = [
    options.subtotal === undefined ? "" : `<div style="padding-top:12px;text-align:right;color:#555;">Subtotal: ${money(options.subtotal)}</div>`,
    options.shipping === undefined ? "" : `<div style="padding-top:6px;text-align:right;color:#555;">Envío: ${Number(options.shipping || 0) > 0 ? money(options.shipping) : "Gratis"}</div>`,
    options.total === undefined ? "" : `<div style="padding-top:10px;text-align:right;font-weight:800;color:#111;">Total: ${money(options.total)}</div>`,
  ].filter(Boolean);

  return rows.join("");
}

export function emailOrderItemsHtml(items: EmailOrderItem[], baseUrl: string, options?: { total?: unknown; subtotal?: unknown; shipping?: unknown }) {
  return emailProductRowsHtml(
    items.map((item) => ({
      name: item.nameSnapshot,
      imageUrl: absoluteImageUrl(baseUrl, item.product?.images?.[0]?.url),
      details: [`Cantidad: ${item.quantity}`, `Unitario: ${money(item.unitPrice)}`],
      amount: money(item.subtotal),
    })),
    options?.total === undefined
      ? undefined
      : { totalHtml: emailTotalsHtml(options) }
  );
}

export function emailOrderItemsText(items: EmailOrderItem[], options?: { total?: unknown; subtotal?: unknown; shipping?: unknown }) {
  const body = items
    .map((item) => `${item.nameSnapshot} x${item.quantity} (${money(item.subtotal)})`)
    .join("; ");
  if (options?.total === undefined) return body;
  const totals = [
    options.subtotal === undefined ? "" : `Subtotal: ${money(options.subtotal)}`,
    options.shipping === undefined ? "" : `Envío: ${Number(options.shipping || 0) > 0 ? money(options.shipping) : "Gratis"}`,
    `Total: ${money(options.total)}`,
  ].filter(Boolean).join(". ");
  return `${body}. ${totals}`;
}
