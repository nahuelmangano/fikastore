type EmailProductRow = {
  name: string;
  imageUrl?: string | null;
  amount?: string;
  details?: string[];
  linkHtml?: string;
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
        ? `<img src="${escapeHtml(row.imageUrl)}" alt="" width="76" height="96" style="display:block;width:76px;height:96px;object-fit:cover;border-radius:4px;border:1px solid #eee;">`
        : `<div style="width:76px;height:96px;border-radius:4px;border:1px solid #eee;background:#f6f6f6;"></div>`;
      const details = (row.details || [])
        .filter((detail) => detail.trim())
        .map((detail) => `<div style="margin-top:5px;font-size:12px;color:#777;">${escapeHtml(detail)}</div>`)
        .join("");

      return `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:14px 0;border-bottom:1px solid #eee;">
          <div style="display:flex;gap:12px;min-width:0;">
            ${image}
            <div style="min-width:0;">
              <div style="font-size:14px;font-weight:700;color:#111;">${escapeHtml(row.name)}</div>
              ${details}
              ${row.linkHtml || ""}
            </div>
          </div>
          ${row.amount ? `<div style="font-size:14px;font-weight:700;color:#111;white-space:nowrap;">${escapeHtml(row.amount)}</div>` : ""}
        </div>
      `;
    })
    .join("");

  return `${body}${options?.totalHtml || ""}`;
}
