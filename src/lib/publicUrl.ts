function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

function isPrivateOrLocalHost(hostname: string) {
  const host = hostname.toLowerCase();

  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;

  return false;
}

function usablePublicUrl(value?: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (isPrivateOrLocalHost(url.hostname)) return null;
    return trimTrailingSlash(url.origin);
  } catch {
    return null;
  }
}

export function publicBaseUrl(req?: Request) {
  const configured =
    usablePublicUrl(process.env.SITE_URL) ||
    usablePublicUrl(process.env.NEXT_PUBLIC_SITE_URL) ||
    usablePublicUrl(process.env.APP_URL) ||
    usablePublicUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    usablePublicUrl(process.env.NEXTAUTH_URL);

  if (configured) return configured;

  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost || req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") || "https";

    if (host) {
      const firstHost = host.split(",")[0]?.trim();
      const firstProto = proto.split(",")[0]?.trim() || "https";
      const fromRequest = usablePublicUrl(`${firstProto}://${firstHost}`);
      if (fromRequest) return fromRequest;
    }

    const origin = usablePublicUrl(req.headers.get("origin"));
    if (origin) return origin;
  }

  return trimTrailingSlash(process.env.SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000");
}
