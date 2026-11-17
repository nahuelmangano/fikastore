/** Split a benefit for display without replacing the merchant's wording. */
export function splitAnnouncementBenefit(text: string) {
  const clean = text.trim();
  const heading = clean.match(
    /^(?:\d+\s+cuotas?(?:\s+sin\s+inter[eé]s)?|\d+(?:[.,]\d+)?\s*%\s*off|env[ií]os?\s+gratis)(?=\s|$)/i
  );

  if (heading) {
    return {
      title: heading[0],
      subtitle: clean.slice(heading[0].length).trim(),
    };
  }

  return { title: clean, subtitle: "" };
}
