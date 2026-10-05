type MetaTrackingContext = {
  fbp: string | null;
  fbc: string | null;
  clientIpAddress: string | null;
  clientUserAgent: string | null;
};

function cleanValue(value: string | null | undefined, maxLength: number) {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function parseCookieHeader(cookieHeader: string | null) {
  const values = new Map<string, string>();
  if (!cookieHeader) return values;

  for (const entry of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = entry.split("=");
    const name = rawName?.trim();
    if (!name) continue;
    values.set(name, rawValue.join("=").trim());
  }

  return values;
}

function firstHeaderValue(value: string | null) {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  return first || null;
}

export function getMetaTrackingContext(req: Request): MetaTrackingContext {
  const cookies = parseCookieHeader(req.headers.get("cookie"));
  const clientIpAddress =
    firstHeaderValue(req.headers.get("x-forwarded-for")) ||
    firstHeaderValue(req.headers.get("x-real-ip")) ||
    null;

  return {
    fbp: cleanValue(cookies.get("_fbp"), 255),
    fbc: cleanValue(cookies.get("_fbc"), 255),
    clientIpAddress: cleanValue(clientIpAddress, 255),
    clientUserAgent: cleanValue(req.headers.get("user-agent"), 1024),
  };
}
