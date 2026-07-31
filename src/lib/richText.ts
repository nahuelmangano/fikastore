export function sanitizeRichText(value: string | null | undefined) {
  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, "")
    .replace(/<img\b(?![^>]*\bsrc=)[^>]*>/gi, "")
    .replace(/<img\b([^>]*)>/gi, (_match, attrs: string) => {
      const src = String(attrs).match(/\ssrc=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const alt = String(attrs).match(/\salt=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
      const srcValue = src?.[1] || src?.[2] || src?.[3] || "";
      const altValue = alt?.[1] || alt?.[2] || alt?.[3] || "";
      if (!srcValue || /^javascript:/i.test(srcValue)) return "";
      return `<img src="${srcValue.replace(/"/g, "&quot;")}" alt="${altValue.replace(/"/g, "&quot;")}" loading="lazy">`;
    })
    .trim();
}

export function stripRichText(value: string | null | undefined) {
  return sanitizeRichText(value)
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
