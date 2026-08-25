import { resolve4, resolve6, resolveCname } from "node:dns/promises";
import net from "node:net";
import { domainToASCII } from "node:url";
import { prisma } from "@/lib/prisma";

export type DomainStatus = "NOT_CONFIGURED" | "PENDING" | "VERIFIED" | "ACTIVE" | "ERROR";

export type CustomDomainSettings = {
  customDomain: string;
  domainStatus: DomainStatus;
  domainVerifiedAt: string | null;
  domainActivatedAt: string | null;
  errorMessage: string | null;
  dnsTarget: string;
  serverIps: string[];
  supportsARecord: boolean;
};

const STORE_KEY = "default";
const DEFAULT_STATUS: DomainStatus = "NOT_CONFIGURED";
const DEFAULT_BLOCKED_ROOT_DOMAINS = ["nmvdevelop.com.ar"];
const DOMAIN_STATUSES = ["NOT_CONFIGURED", "PENDING", "VERIFIED", "ACTIVE", "ERROR"] as const;

function normalizeDomainStatus(value?: string | null): DomainStatus {
  return DOMAIN_STATUSES.includes(value as DomainStatus) ? (value as DomainStatus) : DEFAULT_STATUS;
}

function stripTrailingDot(value: string) {
  return value.trim().toLowerCase().replace(/\.$/, "");
}

function configuredDnsTarget() {
  return stripTrailingDot(process.env.CUSTOM_DOMAIN_TARGET || "domains.nmvdevelop.com.ar");
}

function configuredServerIps() {
  return String(process.env.CUSTOM_DOMAIN_SERVER_IP || "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => net.isIP(item) !== 0);
}

function blockedRootDomains() {
  const configured = String(process.env.CUSTOM_DOMAIN_BLOCKED_ROOT_DOMAINS || "")
    .split(",")
    .map(stripTrailingDot)
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_BLOCKED_ROOT_DOMAINS, configuredDnsTarget(), ...configured]));
}

function isPrivateIpv4(ip: string) {
  return (
    /^10\./.test(ip) ||
    /^127\./.test(ip) ||
    /^169\.254\./.test(ip) ||
    /^192\.168\./.test(ip) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
  );
}

function isPrivateIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

function looksLikeHostname(hostname: string) {
  if (hostname.length < 4 || hostname.length > 253) return false;
  if (!hostname.includes(".")) return false;
  if (hostname.includes("..")) return false;
  if (!/^[a-z0-9.-]+$/.test(hostname)) return false;

  return hostname.split(".").every((label) => {
    if (!label || label.length > 63) return false;
    if (label.startsWith("-") || label.endsWith("-")) return false;
    return /^[a-z0-9-]+$/.test(label);
  });
}

function isBlockedDomain(hostname: string) {
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".test")) return true;

  return blockedRootDomains().some((root) => hostname === root || hostname.endsWith(`.${root}`));
}

export function normalizeCustomDomainInput(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new Error("Ingresá un dominio válido, por ejemplo luzdemarfil.com.ar.");
  }

  if (url.username || url.password || url.port) {
    throw new Error("Ingresá solo el dominio, sin usuario, contraseña ni puerto.");
  }

  if ((url.pathname && url.pathname !== "/") || url.search || url.hash) {
    throw new Error("Ingresá solo el dominio, sin rutas ni parámetros.");
  }

  const asciiHostname = domainToASCII(url.hostname);
  let hostname = stripTrailingDot(asciiHostname);
  if (hostname.startsWith("www.")) hostname = hostname.slice(4);

  if (!looksLikeHostname(hostname)) {
    throw new Error("Ingresá un hostname público válido.");
  }

  const ipVersion = net.isIP(hostname);
  if (ipVersion !== 0) {
    throw new Error("No se aceptan direcciones IP como dominio personalizado.");
  }

  if (isBlockedDomain(hostname)) {
    throw new Error("Ese dominio pertenece a la plataforma o no es público. Usá un dominio propio.");
  }

  return hostname;
}

export async function getCustomDomainSettings(): Promise<CustomDomainSettings> {
  const row = await prisma.storeCustomDomain.findUnique({
    where: { storeKey: STORE_KEY },
  });

  return {
    customDomain: row?.customDomain || "",
    domainStatus: normalizeDomainStatus(row?.domainStatus),
    domainVerifiedAt: row?.domainVerifiedAt?.toISOString() || null,
    domainActivatedAt: row?.domainActivatedAt?.toISOString() || null,
    errorMessage: row?.errorMessage || null,
    dnsTarget: configuredDnsTarget(),
    serverIps: configuredServerIps(),
    supportsARecord: configuredServerIps().length > 0,
  };
}

export async function getCustomDomainOrigin() {
  const row = await prisma.storeCustomDomain.findUnique({
    where: { storeKey: STORE_KEY },
    select: { customDomain: true, domainStatus: true },
  });

  const customDomain = stripTrailingDot(String(row?.customDomain || ""));
  const status = normalizeDomainStatus(row?.domainStatus);

  if (!customDomain) return null;
  if (status !== "ACTIVE" && status !== "VERIFIED") return null;

  return `https://${customDomain}`;
}

export async function setCustomDomain(value: string) {
  if (!value.trim()) {
    await prisma.storeCustomDomain.upsert({
      where: { storeKey: STORE_KEY },
      create: {
        storeKey: STORE_KEY,
        customDomain: null,
        domainStatus: "NOT_CONFIGURED",
        domainVerifiedAt: null,
        domainActivatedAt: null,
        errorMessage: null,
      },
      update: {
        customDomain: null,
        domainStatus: "NOT_CONFIGURED",
        domainVerifiedAt: null,
        domainActivatedAt: null,
        errorMessage: null,
      },
    });

    return getCustomDomainSettings();
  }

  const customDomain = normalizeCustomDomainInput(value);
  const current = await prisma.storeCustomDomain.findUnique({
    where: { storeKey: STORE_KEY },
    select: { customDomain: true },
  });

  if (current?.customDomain === customDomain) {
    return getCustomDomainSettings();
  }

  await prisma.storeCustomDomain.upsert({
    where: { storeKey: STORE_KEY },
    create: {
      storeKey: STORE_KEY,
      customDomain,
      domainStatus: "PENDING",
      domainVerifiedAt: null,
      domainActivatedAt: null,
      errorMessage: null,
    },
    update: {
      customDomain,
      domainStatus: "PENDING",
      domainVerifiedAt: null,
      domainActivatedAt: null,
      errorMessage: null,
    },
  });

  return getCustomDomainSettings();
}

async function resolveCnames(hostname: string) {
  try {
    return (await resolveCname(hostname)).map(stripTrailingDot);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENODATA" || code === "ENOTFOUND" || code === "ETIMEOUT" || code === "EAI_AGAIN") return [];
    throw error;
  }
}

async function resolveAddresses(hostname: string) {
  const [ipv4, ipv6] = await Promise.all([
    resolve4(hostname).catch((error) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENODATA" || code === "ENOTFOUND" || code === "ETIMEOUT" || code === "EAI_AGAIN") return [];
      throw error;
    }),
    resolve6(hostname).catch((error) => {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENODATA" || code === "ENOTFOUND" || code === "ETIMEOUT" || code === "EAI_AGAIN") return [];
      throw error;
    }),
  ]);

  return [...ipv4, ...ipv6];
}

export async function verifyCustomDomainDns() {
  const row = await prisma.storeCustomDomain.findUnique({
    where: { storeKey: STORE_KEY },
    select: { customDomain: true },
  });

  if (!row?.customDomain) {
    return getCustomDomainSettings();
  }

  const domain = row.customDomain;
  const dnsTarget = configuredDnsTarget();
  const expectedIps = configuredServerIps();

  try {
    const [wwwCnames, rootAddresses] = await Promise.all([
      resolveCnames(`www.${domain}`),
      resolveAddresses(domain),
    ]);

    const cnameMatches = wwwCnames.includes(dnsTarget);
    const addressMatches = expectedIps.length > 0 && rootAddresses.some((address) => expectedIps.includes(address));
    const hasPrivateAddress = rootAddresses.some((address) => {
      const ipVersion = net.isIP(address);
      if (ipVersion === 4) return isPrivateIpv4(address);
      if (ipVersion === 6) return isPrivateIpv6(address);
      return false;
    });

    if (hasPrivateAddress) {
      await prisma.storeCustomDomain.update({
        where: { storeKey: STORE_KEY },
        data: {
          domainStatus: "ERROR",
          errorMessage: "El dominio resuelve a una IP privada o local. Configurá un destino público.",
          domainVerifiedAt: null,
          domainActivatedAt: null,
        },
      });
      return getCustomDomainSettings();
    }

    if (cnameMatches || addressMatches) {
      await prisma.storeCustomDomain.update({
        where: { storeKey: STORE_KEY },
        data: {
          domainStatus: "VERIFIED",
          domainVerifiedAt: new Date(),
          domainActivatedAt: null,
          errorMessage: null,
        },
      });
      return getCustomDomainSettings();
    }

    await prisma.storeCustomDomain.update({
      where: { storeKey: STORE_KEY },
      data: {
        domainStatus: "PENDING",
        errorMessage: null,
        domainActivatedAt: null,
      },
    });
    return getCustomDomainSettings();
  } catch (error) {
    await prisma.storeCustomDomain.update({
      where: { storeKey: STORE_KEY },
      data: {
        domainStatus: "ERROR",
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "No se pudo consultar DNS.",
        domainActivatedAt: null,
      },
    });
    return getCustomDomainSettings();
  }
}
