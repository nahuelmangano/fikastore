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
const EMAIL_JOB_SETTINGS_KEY = "email_job_settings";
const MERCADOPAGO_SETTINGS_KEY = "mercadopago_settings";
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

export type EmailJobSettings = {
  paymentRemindersEnabled: boolean;
  paymentReminderHours: number[];
  maxPaymentReminders: number;
  reviewRequestEnabled: boolean;
  reviewRequestDelayDays: number;
  birthdayCouponEnabled: boolean;
  birthdayCouponOffsetDays: number;
  birthdayCouponDiscountType: "percent" | "amount";
  birthdayCouponDiscountValue: number;
  birthdayCouponDurationDays: number;
  birthdayCouponMinPurchaseAmount: number;
  birthdayCouponMaxUses: number;
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

export type MercadoPagoSettings = {
  accessTokenConfigured: boolean;
  source: "oauth" | "manual" | "env" | "none";
  connectedUserId?: string;
  expiresAt?: string;
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

type StoredMercadoPagoSettings = {
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  expiresAt?: string;
  connectedUserId?: string;
  tokenType?: string;
  scope?: string;
  mode?: "oauth" | "manual";
};

export const DEFAULT_TEMPORARY_SHUTDOWN_MESSAGE =
  "La tienda se encuentra apagada temporalmente. Volve a visitarnos pronto.";

export const DEFAULT_EMAIL_JOB_SETTINGS: EmailJobSettings = {
  paymentRemindersEnabled: true,
  paymentReminderHours: [24, 48],
  maxPaymentReminders: 2,
  reviewRequestEnabled: true,
  reviewRequestDelayDays: 10,
  birthdayCouponEnabled: true,
  birthdayCouponOffsetDays: 0,
  birthdayCouponDiscountType: "percent",
  birthdayCouponDiscountValue: 15,
  birthdayCouponDurationDays: 14,
  birthdayCouponMinPurchaseAmount: 0,
  birthdayCouponMaxUses: 1,
};

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

function normalizeEmailJobSettings(value: Partial<EmailJobSettings> | null | undefined): EmailJobSettings {
  const reminderHours = Array.isArray(value?.paymentReminderHours)
    ? value.paymentReminderHours
        .map((item) => Math.floor(Number(item)))
        .filter((item) => Number.isFinite(item) && item > 0 && item <= 24 * 30)
        .slice(0, 5)
    : DEFAULT_EMAIL_JOB_SETTINGS.paymentReminderHours;

  return {
    paymentRemindersEnabled: value?.paymentRemindersEnabled !== false,
    paymentReminderHours: reminderHours.length ? reminderHours : DEFAULT_EMAIL_JOB_SETTINGS.paymentReminderHours,
    maxPaymentReminders: Math.max(0, Math.min(5, Math.floor(Number(value?.maxPaymentReminders ?? DEFAULT_EMAIL_JOB_SETTINGS.maxPaymentReminders)))),
    reviewRequestEnabled: value?.reviewRequestEnabled !== false,
    reviewRequestDelayDays: Math.max(7, Math.min(15, Math.floor(Number(value?.reviewRequestDelayDays ?? DEFAULT_EMAIL_JOB_SETTINGS.reviewRequestDelayDays)))),
    birthdayCouponEnabled: value?.birthdayCouponEnabled !== false,
    birthdayCouponOffsetDays: Math.max(-30, Math.min(30, Math.floor(Number(value?.birthdayCouponOffsetDays ?? DEFAULT_EMAIL_JOB_SETTINGS.birthdayCouponOffsetDays)))),
    birthdayCouponDiscountType: value?.birthdayCouponDiscountType === "amount" ? "amount" : "percent",
    birthdayCouponDiscountValue: Math.max(0, Number(value?.birthdayCouponDiscountValue ?? DEFAULT_EMAIL_JOB_SETTINGS.birthdayCouponDiscountValue)),
    birthdayCouponDurationDays: Math.max(1, Math.min(365, Math.floor(Number(value?.birthdayCouponDurationDays ?? DEFAULT_EMAIL_JOB_SETTINGS.birthdayCouponDurationDays)))),
    birthdayCouponMinPurchaseAmount: Math.max(0, Number(value?.birthdayCouponMinPurchaseAmount ?? DEFAULT_EMAIL_JOB_SETTINGS.birthdayCouponMinPurchaseAmount)),
    birthdayCouponMaxUses: Math.max(1, Math.min(20, Math.floor(Number(value?.birthdayCouponMaxUses ?? DEFAULT_EMAIL_JOB_SETTINGS.birthdayCouponMaxUses)))),
  };
}

export async function getEmailJobSettings(): Promise<EmailJobSettings> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: EMAIL_JOB_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return DEFAULT_EMAIL_JOB_SETTINGS;

  try {
    return normalizeEmailJobSettings(JSON.parse(row.value) as Partial<EmailJobSettings>);
  } catch {
    return DEFAULT_EMAIL_JOB_SETTINGS;
  }
}

export async function setEmailJobSettings(settings: Partial<EmailJobSettings>) {
  const value = JSON.stringify(normalizeEmailJobSettings(settings));

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: EMAIL_JOB_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: EMAIL_JOB_SETTINGS_KEY,
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

export function canEncryptMercadoPagoSecrets() {
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

  const payload = value.slice(ENCRYPTED_VALUE_PREFIX.length).replace(/^\./, "");
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

async function getStoredMercadoPagoSettings(): Promise<StoredMercadoPagoSettings | null> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MERCADOPAGO_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return null;

  try {
    const parsed = JSON.parse(row.value) as Partial<StoredMercadoPagoSettings>;
    const encryptedAccessToken = String(parsed.encryptedAccessToken || "").trim();
    return encryptedAccessToken ? { encryptedAccessToken } : null;
  } catch {
    return null;
  }
}

export async function getMercadoPagoSettings(): Promise<MercadoPagoSettings> {
  const stored = await getStoredMercadoPagoSettings();
  const envAccessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();

  if (stored?.encryptedAccessToken) {
    return {
      accessTokenConfigured: true,
      source: stored.mode === "oauth" || stored.encryptedRefreshToken ? "oauth" : "manual",
      connectedUserId: stored.connectedUserId,
      expiresAt: stored.expiresAt,
    };
  }

  if (envAccessToken) {
    return { accessTokenConfigured: true, source: "env" };
  }

  return { accessTokenConfigured: false, source: "none" };
}

export async function setMercadoPagoSettings(settings: { accessToken?: string }) {
  const accessToken = String(settings.accessToken || "").trim();

  if (!accessToken) {
    return prisma.shippingProviderSetting.deleteMany({
      where: { provider: STOREFRONT_SETTINGS_PROVIDER, key: MERCADOPAGO_SETTINGS_KEY },
    });
  }

  if (!canEncryptMercadoPagoSecrets()) {
    throw new Error("APP_SECRET_ENCRYPTION_KEY or MAILING_ENCRYPTION_KEY missing");
  }

  const value: StoredMercadoPagoSettings = {
    encryptedAccessToken: encryptSecret(accessToken),
    mode: "manual",
  };

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MERCADOPAGO_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: MERCADOPAGO_SETTINGS_KEY,
      value: JSON.stringify(value),
      isSecret: true,
    },
    update: {
      value: JSON.stringify(value),
      isSecret: true,
    },
  });
}

export async function setMercadoPagoOAuthSettings(settings: {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  connectedUserId?: string;
  tokenType?: string;
  scope?: string;
}) {
  const accessToken = String(settings.accessToken || "").trim();
  const refreshToken = String(settings.refreshToken || "").trim();

  if (!accessToken) throw new Error("Mercado Pago access token missing");
  if (!canEncryptMercadoPagoSecrets()) {
    throw new Error("APP_SECRET_ENCRYPTION_KEY or MAILING_ENCRYPTION_KEY missing");
  }

  const expiresIn = Number(settings.expiresIn || 0);
  const expiresAt =
    Number.isFinite(expiresIn) && expiresIn > 0
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : undefined;

  const value: StoredMercadoPagoSettings = {
    encryptedAccessToken: encryptSecret(accessToken),
    encryptedRefreshToken: refreshToken ? encryptSecret(refreshToken) : undefined,
    expiresAt,
    connectedUserId: String(settings.connectedUserId || "").trim() || undefined,
    tokenType: String(settings.tokenType || "").trim() || undefined,
    scope: String(settings.scope || "").trim() || undefined,
    mode: "oauth",
  };

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MERCADOPAGO_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: MERCADOPAGO_SETTINGS_KEY,
      value: JSON.stringify(value),
      isSecret: true,
    },
    update: {
      value: JSON.stringify(value),
      isSecret: true,
    },
  });
}

export async function clearMercadoPagoSettings() {
  return prisma.shippingProviderSetting.deleteMany({
    where: { provider: STOREFRONT_SETTINGS_PROVIDER, key: MERCADOPAGO_SETTINGS_KEY },
  });
}

async function refreshMercadoPagoOAuthToken(stored: StoredMercadoPagoSettings) {
  const clientId = String(process.env.MP_OAUTH_CLIENT_ID || process.env.MP_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.MP_OAUTH_CLIENT_SECRET || process.env.MP_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret || !stored.encryptedRefreshToken) {
    return decryptSecret(stored.encryptedAccessToken || "");
  }

  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptSecret(stored.encryptedRefreshToken),
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Mercado Pago OAuth refresh failed: ${JSON.stringify(data)}`);
  }

  await setMercadoPagoOAuthSettings({
    accessToken: String(data.access_token || ""),
    refreshToken: String(data.refresh_token || ""),
    expiresIn: Number(data.expires_in || 0),
    connectedUserId: data.user_id ? String(data.user_id) : stored.connectedUserId,
    tokenType: data.token_type ? String(data.token_type) : stored.tokenType,
    scope: data.scope ? String(data.scope) : stored.scope,
  });

  return String(data.access_token || "");
}

export async function getResolvedMercadoPagoAccessToken() {
  const stored = await getStoredMercadoPagoSettings();
  if (stored?.encryptedAccessToken) {
    if (stored.encryptedRefreshToken && stored.expiresAt) {
      const expiresAt = new Date(stored.expiresAt).getTime();
      const shouldRefresh = Number.isFinite(expiresAt) && expiresAt - Date.now() < 7 * 24 * 60 * 60 * 1000;
      if (shouldRefresh) return refreshMercadoPagoOAuthToken(stored);
    }

    return decryptSecret(stored.encryptedAccessToken);
  }

  return String(process.env.MP_ACCESS_TOKEN || "").trim();
}
