export function sanitizeRichText(value: string | null | undefined) {
  function attr(attrs: string, name: string) {
    const match = attrs.match(new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
    return match?.[1] || match?.[2] || match?.[3] || "";
  }

  function cleanAttr(value: string) {
    return value.replace(/"/g, "&quot;");
  }

  return String(value || "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=(?:"javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, "")
    .replace(/<img\b(?![^>]*\bsrc=)[^>]*>/gi, "")
    .replace(/<img\b([^>]*)>/gi, (_match, attrs: string) => {
      const srcValue = attr(String(attrs), "src");
      const altValue = attr(String(attrs), "alt");
      const width = attr(String(attrs), "width").replace(/[^\d]/g, "");
      const height = attr(String(attrs), "height").replace(/[^\d]/g, "");
      const style = attr(String(attrs), "style");
      if (!srcValue || /^javascript:/i.test(srcValue)) return "";
      const safeStyle = /javascript:|expression\s*\(|url\s*\(/i.test(style) ? "" : style;
      return [
        `<img src="${cleanAttr(srcValue)}"`,
        `alt="${cleanAttr(altValue)}"`,
        width ? `width="${width}"` : "",
        height ? `height="${height}"` : "",
        safeStyle ? `style="${cleanAttr(safeStyle)}"` : "",
        ">",
      ].filter(Boolean).join(" ");
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
