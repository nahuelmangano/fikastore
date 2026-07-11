import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const STOREFRONT_SETTINGS_PROVIDER = "storefront";
const ANNOUNCEMENT_TEXT_KEY = "announcement_text";
const LOGO_URL_KEY = "logo_url";
const HOME_CATEGORY_TILES_KEY = "home_category_tiles";
const SITE_TITLE_KEY = "site_title";
const FAVICON_URL_KEY = "favicon_url";
const TEMPORARY_SHUTDOWN_KEY = "temporary_shutdown";
const MAILING_SETTINGS_KEY = "mailing_settings";
const MAILING_SMTP_SETTINGS_KEY = "mailing_smtp_settings";
const ENCRYPTED_VALUE_PREFIX = "enc:v1:";

export const DEFAULT_ANNOUNCEMENT_TEXT =
  "3 CUOTAS SIN INTERES A PARTIR DE $50.000 | 15% OFF ABONANDO EN EFECTIVO O TRANSFERENCIA | ENVIOS GRATIS A SUCURSAL A PARTIR DE $43000";
export const DEFAULT_LOGO_URL = "/fika-logo.svg";
export const DEFAULT_SITE_TITLE = "Fika Store";
export const DEFAULT_FAVICON_URL = "/favicon.ico";

export type HomeCategoryTile = {
  id: string;
  categoryId: string;
  categorySlug: string;
  title: string;
  imageUrl: string;
};

export type TemporaryShutdownSettings = {
  isShutdown: boolean;
  message: string;
};

export type MailingSettings = {
  purchaseEnabled: boolean;
  purchaseSubject: string;
  purchaseMessage: string;
  backInStockEnabled: boolean;
  backInStockSubject: string;
  backInStockMessage: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
  smtpReplyTo: string;
  smtpPassConfigured: boolean;
  smtpSource: "admin" | "env" | "none";
};

export type ResolvedSmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  source: "admin" | "env";
};

type StoredMailingSettings = Pick<
  MailingSettings,
  | "purchaseEnabled"
  | "purchaseSubject"
  | "purchaseMessage"
  | "backInStockEnabled"
  | "backInStockSubject"
  | "backInStockMessage"
>;

type StoredMailingSmtpSettings = {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
  smtpReplyTo: string;
  encryptedSmtpPass?: string;
};

export const DEFAULT_TEMPORARY_SHUTDOWN_MESSAGE =
  "La tienda se encuentra apagada temporalmente. Volve a visitarnos pronto.";

export const DEFAULT_MAILING_SETTINGS: MailingSettings = {
  purchaseEnabled: true,
  purchaseSubject: "FikaStore · Pago confirmado ✅",
  purchaseMessage: "Te vamos a avisar cuando despachemos tu pedido.",
  backInStockEnabled: true,
  backInStockSubject: "FikaStore · {{productName}} volvió a estar disponible",
  backInStockMessage: "Ya podés volver a la tienda para verlo y completar tu compra.",
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpFrom: "",
  smtpReplyTo: "",
  smtpPassConfigured: false,
  smtpSource: "none",
};

export async function getAnnouncementText() {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: ANNOUNCEMENT_TEXT_KEY,
      },
    },
    select: { value: true },
  });

  return row?.value?.trim() || DEFAULT_ANNOUNCEMENT_TEXT;
}

export async function setAnnouncementText(value: string) {
  const text = value.trim();

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: ANNOUNCEMENT_TEXT_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: ANNOUNCEMENT_TEXT_KEY,
      value: text,
      isSecret: false,
    },
    update: {
      value: text,
      isSecret: false,
    },
  });
}

export async function getStoreLogoUrl() {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: LOGO_URL_KEY,
      },
    },
    select: { value: true },
  });

  return row?.value?.trim() || DEFAULT_LOGO_URL;
}

export async function setStoreLogoUrl(value: string) {
  const url = value.trim();

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: LOGO_URL_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: LOGO_URL_KEY,
      value: url,
      isSecret: false,
    },
    update: {
      value: url,
      isSecret: false,
    },
  });
}

export async function getSiteTitle() {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: SITE_TITLE_KEY,
      },
    },
    select: { value: true },
  });

  return row?.value?.trim() || DEFAULT_SITE_TITLE;
}

export async function setSiteTitle(value: string) {
  const title = value.trim();

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: SITE_TITLE_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: SITE_TITLE_KEY,
      value: title,
      isSecret: false,
    },
    update: {
      value: title,
      isSecret: false,
    },
  });
}

export async function getFaviconUrl() {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: FAVICON_URL_KEY,
      },
    },
    select: { value: true },
  });

  return row?.value?.trim() || DEFAULT_FAVICON_URL;
}

export async function setFaviconUrl(value: string) {
  const url = value.trim();

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: FAVICON_URL_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: FAVICON_URL_KEY,
      value: url,
      isSecret: false,
    },
    update: {
      value: url,
      isSecret: false,
    },
  });
}

export async function getHomeCategoryTiles() {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: HOME_CATEGORY_TILES_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return [];

  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const tile = item as Partial<HomeCategoryTile>;
        const id = String(tile.id || "").trim();
        const categoryId = String(tile.categoryId || "").trim();
        const categorySlug = String(tile.categorySlug || "").trim();
        const title = String(tile.title || "").trim();
        const imageUrl = String(tile.imageUrl || "").trim();
        if (!id || !categoryId || !categorySlug || !title || !imageUrl) return null;
        return { id, categoryId, categorySlug, title, imageUrl };
      })
      .filter((item): item is HomeCategoryTile => Boolean(item));
  } catch {
    return [];
  }
}

export async function setHomeCategoryTiles(tiles: HomeCategoryTile[]) {
  const value = JSON.stringify(tiles.slice(0, 6));

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: HOME_CATEGORY_TILES_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: HOME_CATEGORY_TILES_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
      isSecret: false,
    },
  });
}

export async function getTemporaryShutdownSettings(): Promise<TemporaryShutdownSettings> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: TEMPORARY_SHUTDOWN_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return { isShutdown: false, message: DEFAULT_TEMPORARY_SHUTDOWN_MESSAGE };

  try {
    const parsed = JSON.parse(row.value) as Partial<TemporaryShutdownSettings>;
    return {
      isShutdown: parsed.isShutdown === true,
      message: String(parsed.message || "").trim() || DEFAULT_TEMPORARY_SHUTDOWN_MESSAGE,
    };
  } catch {
    return { isShutdown: false, message: DEFAULT_TEMPORARY_SHUTDOWN_MESSAGE };
  }
}

export async function setTemporaryShutdownSettings(settings: TemporaryShutdownSettings) {
  const value = JSON.stringify({
    isShutdown: settings.isShutdown === true,
    message: settings.message.trim() || DEFAULT_TEMPORARY_SHUTDOWN_MESSAGE,
  });

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: TEMPORARY_SHUTDOWN_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: TEMPORARY_SHUTDOWN_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
      isSecret: false,
    },
  });
}

function normalizeMailingContentSettings(value: Partial<MailingSettings> | null | undefined): StoredMailingSettings {
  return {
    purchaseEnabled: value?.purchaseEnabled !== false,
    purchaseSubject: String(value?.purchaseSubject || "").trim() || DEFAULT_MAILING_SETTINGS.purchaseSubject,
    purchaseMessage: String(value?.purchaseMessage || "").trim() || DEFAULT_MAILING_SETTINGS.purchaseMessage,
    backInStockEnabled: value?.backInStockEnabled !== false,
    backInStockSubject: String(value?.backInStockSubject || "").trim() || DEFAULT_MAILING_SETTINGS.backInStockSubject,
    backInStockMessage: String(value?.backInStockMessage || "").trim() || DEFAULT_MAILING_SETTINGS.backInStockMessage,
  };
}

function encryptionKey() {
  const secret = process.env.MAILING_ENCRYPTION_KEY || process.env.APP_SECRET_ENCRYPTION_KEY || "";
  if (!secret.trim()) return null;
  return crypto.createHash("sha256").update(secret).digest();
}

export function canEncryptMailingSecrets() {
  return Boolean(encryptionKey());
}

function encryptSecret(value: string) {
  const key = encryptionKey();
  if (!key) throw new Error("MAILING_ENCRYPTION_KEY missing");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTED_VALUE_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptSecret(value: string) {
  if (!value.startsWith(ENCRYPTED_VALUE_PREFIX)) return value;

  const key = encryptionKey();
  if (!key) throw new Error("MAILING_ENCRYPTION_KEY missing");

  const payload = value.slice(ENCRYPTED_VALUE_PREFIX.length);
  const [iv, tag, encrypted] = payload.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Invalid encrypted mailing secret");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function envSmtpSettings() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = String(process.env.SMTP_PORT || "587").trim();
  const user = String(process.env.SMTP_USER || "").trim();
  const pass = String(process.env.SMTP_PASS || "").trim();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  return { host, port, user, pass, from };
}

function normalizeSmtpSettings(value: Partial<StoredMailingSmtpSettings> | null | undefined): StoredMailingSmtpSettings {
  const port = String(value?.smtpPort || "").trim() || "587";
  return {
    smtpHost: String(value?.smtpHost || "").trim(),
    smtpPort: port,
    smtpUser: String(value?.smtpUser || "").trim(),
    smtpFrom: String(value?.smtpFrom || "").trim(),
    smtpReplyTo: String(value?.smtpReplyTo || "").trim(),
    encryptedSmtpPass: String(value?.encryptedSmtpPass || "").trim() || undefined,
  };
}

async function getStoredMailingSmtpSettings(): Promise<StoredMailingSmtpSettings | null> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MAILING_SMTP_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return null;

  try {
    return normalizeSmtpSettings(JSON.parse(row.value) as Partial<StoredMailingSmtpSettings>);
  } catch {
    return null;
  }
}

export async function getResolvedSmtpConfig(): Promise<ResolvedSmtpConfig> {
  const stored = await getStoredMailingSmtpSettings();
  if (stored?.smtpHost && stored.smtpUser && stored.encryptedSmtpPass) {
    const pass = decryptSecret(stored.encryptedSmtpPass);
    if (pass) {
      return {
        host: stored.smtpHost,
        port: Number(stored.smtpPort || "587"),
        user: stored.smtpUser,
        pass,
        from: stored.smtpFrom || stored.smtpUser,
        replyTo: stored.smtpReplyTo || undefined,
        source: "admin",
      };
    }
  }

  const env = envSmtpSettings();
  if (!env.host || !env.user || !env.pass) {
    throw new Error("SMTP config missing (admin settings or SMTP_HOST/SMTP_USER/SMTP_PASS)");
  }

  return {
    host: env.host,
    port: Number(env.port || "587"),
    user: env.user,
    pass: env.pass,
    from: env.from || env.user,
    source: "env",
  };
}

export async function setMailingSmtpSettings(settings: {
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpFrom: string;
  smtpReplyTo: string;
  smtpPass?: string;
}) {
  const current = await getStoredMailingSmtpSettings();
  const smtpPass = String(settings.smtpPass || "").trim();

  if (smtpPass && !canEncryptMailingSecrets()) {
    throw new Error("MAILING_ENCRYPTION_KEY missing");
  }

  const value = normalizeSmtpSettings({
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpFrom: settings.smtpFrom,
    smtpReplyTo: settings.smtpReplyTo,
    encryptedSmtpPass: smtpPass ? encryptSecret(smtpPass) : current?.encryptedSmtpPass,
  });

  const hasPublicConfig = Boolean(value.smtpHost || value.smtpUser || value.smtpFrom || value.smtpReplyTo);
  if (!hasPublicConfig && !smtpPass) {
    return prisma.shippingProviderSetting.deleteMany({
      where: { provider: STOREFRONT_SETTINGS_PROVIDER, key: MAILING_SMTP_SETTINGS_KEY },
    });
  }

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MAILING_SMTP_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: MAILING_SMTP_SETTINGS_KEY,
      value: JSON.stringify(value),
      isSecret: true,
    },
    update: {
      value: JSON.stringify(value),
      isSecret: true,
    },
  });
}

export async function getMailingSettings(): Promise<MailingSettings> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MAILING_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  const content = row?.value
    ? (() => {
        try {
          return normalizeMailingContentSettings(JSON.parse(row.value) as Partial<MailingSettings>);
        } catch {
          return normalizeMailingContentSettings(null);
        }
      })()
    : normalizeMailingContentSettings(null);

  const storedSmtp = await getStoredMailingSmtpSettings();
  const envSmtp = envSmtpSettings();
  const smtpSource = storedSmtp?.smtpHost && storedSmtp.smtpUser && storedSmtp.encryptedSmtpPass
    ? "admin"
    : envSmtp.host && envSmtp.user && envSmtp.pass
      ? "env"
      : "none";

  return {
    ...content,
    smtpHost: storedSmtp?.smtpHost || "",
    smtpPort: storedSmtp?.smtpPort || envSmtp.port || "587",
    smtpUser: storedSmtp?.smtpUser || "",
    smtpFrom: storedSmtp?.smtpFrom || "",
    smtpReplyTo: storedSmtp?.smtpReplyTo || "",
    smtpPassConfigured: Boolean(storedSmtp?.encryptedSmtpPass),
    smtpSource,
  };
}

export async function setMailingSettings(settings: MailingSettings) {
  const value = JSON.stringify(normalizeMailingContentSettings(settings));

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MAILING_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: MAILING_SETTINGS_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
      isSecret: false,
    },
  });
}
