import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const STOREFRONT_SETTINGS_PROVIDER = "storefront";
const ANNOUNCEMENT_TEXT_KEY = "announcement_text";
const LOGO_URL_KEY = "logo_url";
const HOME_CATEGORY_TILES_KEY = "home_category_tiles";
const HOME_BANNER_SETTINGS_KEY = "home_banner_settings";
const SITE_TITLE_KEY = "site_title";
const FAVICON_URL_KEY = "favicon_url";
const TEMPORARY_SHUTDOWN_KEY = "temporary_shutdown";
const MAILING_SETTINGS_KEY = "mailing_settings";
const MAILING_SMTP_SETTINGS_KEY = "mailing_smtp_settings";
const EMAIL_JOB_SETTINGS_KEY = "email_job_settings";
const MERCADOPAGO_SETTINGS_KEY = "mercadopago_settings";
const MANUAL_PAYMENT_SETTINGS_KEY = "manual_payment_settings";
const PAYMENT_FINANCING_DISPLAY_SETTINGS_KEY = "payment_financing_display_settings";
const INSTALLMENT_PLANS_SETTINGS_KEY = "installment_plans_settings";
const GOOGLE_ANALYTICS_MEASUREMENT_ID_KEY = "google_analytics_measurement_id";
const META_PIXEL_ID_KEY = "meta_pixel_id";
const SOCIAL_LINKS_SETTINGS_KEY = "social_links_settings";
const METRICS_SETTINGS_KEY = "metrics_settings";
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

export type HomeBannerSlide = {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  href: string;
};

export type HomeBannerSettings = {
  enabled: boolean;
  slides: HomeBannerSlide[];
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
  smtpAuthType: "password" | "microsoft_oauth2";
  smtpMicrosoftClientId: string;
  smtpMicrosoftTenantId: string;
  smtpMicrosoftClientSecretConfigured: boolean;
  smtpMicrosoftRefreshTokenConfigured: boolean;
  smtpSource: "admin" | "env" | "none";
};

export type ResolvedSmtpPasswordConfig = {
  authType: "password";
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  replyTo?: string;
  source: "admin" | "env";
};

export type ResolvedSmtpMicrosoftOAuth2Config = {
  authType: "microsoft_oauth2";
  host: string;
  port: number;
  user: string;
  from: string;
  replyTo?: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tenantId: string;
  source: "admin";
};

export type ResolvedSmtpConfig = ResolvedSmtpPasswordConfig | ResolvedSmtpMicrosoftOAuth2Config;

export type MercadoPagoSettings = {
  accessTokenConfigured: boolean;
  source: "oauth" | "manual" | "env" | "none";
  connectedUserId?: string;
  expiresAt?: string;
};

export type ManualPaymentMethodKey = "agreement" | "cash" | "transfer";

export type TransferBankDetails = {
  accountNumber: string;
  cbu: string;
  alias: string;
  holder: string;
  taxId: string;
  accountType: string;
  bank: string;
};

export type ManualPaymentMethodSettings = {
  key: ManualPaymentMethodKey;
  label: string;
  enabled: boolean;
  instructions: string;
  bankDetails?: TransferBankDetails;
};

export type CheckoutPaymentSettings = {
  mercadopagoEnabled: boolean;
  manualMethods: ManualPaymentMethodSettings[];
  financingDisplay: PaymentFinancingDisplaySettings;
  installmentPlans: InstallmentPlan[];
};

export type PaymentFinancingDisplaySettings = {
  goCuotas: boolean;
  mercadopago: boolean;
  manualMethods: Record<ManualPaymentMethodKey, boolean>;
  merchantCanSee: boolean;
  merchantOptions: {
    goCuotas: boolean;
    mercadopago: boolean;
    manualMethods: Record<ManualPaymentMethodKey, boolean>;
  };
};

export type InstallmentPlan = {
  installments: number;
  minimumAmount: number;
};

export type AnalyticsSettings = {
  googleAnalyticsMeasurementId: string;
  metaPixelId: string;
};

export type SocialLinksSettings = {
  facebook: string;
  instagram: string;
  tiktok: string;
};

export type MetricsSettings = {
  startAt: string | null;
};

const DEFAULT_MANUAL_PAYMENT_METHODS: ManualPaymentMethodSettings[] = [
  {
    key: "agreement",
    label: "Acordar con la tienda",
    enabled: true,
    instructions: "Nos vamos a contactar para coordinar el pago.",
  },
  {
    key: "cash",
    label: "Efectivo",
    enabled: true,
    instructions: "Pagás en efectivo al retirar o según lo acordado con la tienda.",
  },
  {
    key: "transfer",
    label: "Transferencia",
    enabled: true,
    bankDetails: {
      accountNumber: "5025-566703/8",
      cbu: "0140033503502556670388",
      alias: "FIKAPIJAMAS",
      holder: "CINTIA YANINA,NIZ",
      taxId: "27-37175129-2",
      accountType: "Caja de Ahorro",
      bank: "Banco de la Provincia de Buenos Aires",
    },
    instructions: [
      "Recordá enviar el comprobante por mail, indicando el número de pedido, para poder confirmar tu compra.",
    ].join("\n"),
  },
];

const DEFAULT_PAYMENT_FINANCING_DISPLAY_SETTINGS: PaymentFinancingDisplaySettings = {
  goCuotas: true,
  mercadopago: true,
  merchantCanSee: true,
  manualMethods: {
    agreement: true,
    cash: true,
    transfer: true,
  },
  merchantOptions: {
    goCuotas: true,
    mercadopago: true,
    manualMethods: { agreement: true, cash: true, transfer: true },
  },
};

export const DEFAULT_INSTALLMENT_PLANS: InstallmentPlan[] = [{ installments: 3, minimumAmount: 50000 }];

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
  smtpAuthType?: "password" | "microsoft_oauth2";
  smtpMicrosoftClientId?: string;
  smtpMicrosoftTenantId?: string;
  encryptedSmtpPass?: string;
  encryptedMicrosoftClientSecret?: string;
  encryptedMicrosoftRefreshToken?: string;
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
  smtpAuthType: "password",
  smtpMicrosoftClientId: "",
  smtpMicrosoftTenantId: "common",
  smtpMicrosoftClientSecretConfigured: false,
  smtpMicrosoftRefreshTokenConfigured: false,
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

export function normalizeGoogleAnalyticsMeasurementId(value: string) {
  return value.trim().toUpperCase();
}

export function isValidGoogleAnalyticsMeasurementId(value: string) {
  return /^G-[A-Z0-9]{4,32}$/.test(normalizeGoogleAnalyticsMeasurementId(value));
}

export function normalizeMetaPixelId(value: string) {
  return value.trim().replace(/\D/g, "");
}

export function isValidMetaPixelId(value: string) {
  return /^\d{5,30}$/.test(normalizeMetaPixelId(value));
}

export async function getAnalyticsSettings(): Promise<AnalyticsSettings> {
  const [googleAnalyticsRow, metaPixelRow] = await Promise.all([
    prisma.shippingProviderSetting.findUnique({
      where: {
        provider_key: {
          provider: STOREFRONT_SETTINGS_PROVIDER,
          key: GOOGLE_ANALYTICS_MEASUREMENT_ID_KEY,
        },
      },
      select: { value: true },
    }),
    prisma.shippingProviderSetting.findUnique({
      where: {
        provider_key: {
          provider: STOREFRONT_SETTINGS_PROVIDER,
          key: META_PIXEL_ID_KEY,
        },
      },
      select: { value: true },
    }),
  ]);

  const googleAnalyticsMeasurementId = normalizeGoogleAnalyticsMeasurementId(googleAnalyticsRow?.value || "");
  const metaPixelId = normalizeMetaPixelId(metaPixelRow?.value || "");
  return {
    googleAnalyticsMeasurementId: isValidGoogleAnalyticsMeasurementId(googleAnalyticsMeasurementId)
      ? googleAnalyticsMeasurementId
      : "",
    metaPixelId: isValidMetaPixelId(metaPixelId) ? metaPixelId : "",
  };
}

export async function setAnalyticsSettings(settings: AnalyticsSettings) {
  const googleAnalyticsMeasurementId = normalizeGoogleAnalyticsMeasurementId(settings.googleAnalyticsMeasurementId);
  const metaPixelId = normalizeMetaPixelId(settings.metaPixelId);

  return Promise.all([
    prisma.shippingProviderSetting.upsert({
      where: {
        provider_key: {
          provider: STOREFRONT_SETTINGS_PROVIDER,
          key: GOOGLE_ANALYTICS_MEASUREMENT_ID_KEY,
        },
      },
      create: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: GOOGLE_ANALYTICS_MEASUREMENT_ID_KEY,
        value: googleAnalyticsMeasurementId,
        isSecret: false,
      },
      update: {
        value: googleAnalyticsMeasurementId,
        isSecret: false,
      },
    }),
    prisma.shippingProviderSetting.upsert({
      where: {
        provider_key: {
          provider: STOREFRONT_SETTINGS_PROVIDER,
          key: META_PIXEL_ID_KEY,
        },
      },
      create: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: META_PIXEL_ID_KEY,
        value: metaPixelId,
        isSecret: false,
      },
      update: {
        value: metaPixelId,
        isSecret: false,
      },
    }),
  ]);
}

function normalizeMetricsStartAt(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeMetricsSettings(input: unknown): MetricsSettings {
  const value = input && typeof input === "object" ? input as Partial<MetricsSettings> : {};
  return {
    startAt: normalizeMetricsStartAt(value.startAt),
  };
}

export async function getMetricsSettings(): Promise<MetricsSettings> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: METRICS_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return { startAt: null };

  try {
    return normalizeMetricsSettings(JSON.parse(row.value));
  } catch {
    return { startAt: null };
  }
}

export async function setMetricsSettings(settings: unknown) {
  const value = JSON.stringify(normalizeMetricsSettings(settings));

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: METRICS_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: METRICS_SETTINGS_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
      isSecret: false,
    },
  });
}

function normalizeSocialUrl(value: unknown) {
  const raw = String(value || "").trim().slice(0, 300);
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(raw)) return `https://${raw}`;
  return raw;
}

function normalizeSocialLinksSettings(input: unknown): SocialLinksSettings {
  const value = input && typeof input === "object" ? input as Partial<SocialLinksSettings> : {};
  return {
    facebook: normalizeSocialUrl(value.facebook),
    instagram: normalizeSocialUrl(value.instagram),
    tiktok: normalizeSocialUrl(value.tiktok),
  };
}

export async function getSocialLinksSettings(): Promise<SocialLinksSettings> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: SOCIAL_LINKS_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return normalizeSocialLinksSettings(null);

  try {
    return normalizeSocialLinksSettings(JSON.parse(row.value));
  } catch {
    return normalizeSocialLinksSettings(null);
  }
}

export async function setSocialLinksSettings(settings: unknown) {
  const value = JSON.stringify(normalizeSocialLinksSettings(settings));

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: SOCIAL_LINKS_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: SOCIAL_LINKS_SETTINGS_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
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
  const value = JSON.stringify(tiles);

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

export async function getHomeBannerSettings(): Promise<HomeBannerSettings> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: HOME_BANNER_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return { enabled: false, slides: [] };

  try {
    const parsed = JSON.parse(row.value) as Partial<HomeBannerSettings>;
    const rawSlides = Array.isArray(parsed.slides) ? parsed.slides : [];
    const slides = rawSlides
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const slide = item as Partial<HomeBannerSlide>;
        const id = String(slide.id || "").trim();
        const imageUrl = String(slide.imageUrl || "").trim();
        const title = String(slide.title || "").trim();
        const subtitle = String(slide.subtitle || "").trim();
        const href = String(slide.href || "").trim();
        if (!id || !imageUrl) return null;
        return { id, imageUrl, title, subtitle, href };
      })
      .filter((item): item is HomeBannerSlide => Boolean(item));

    return { enabled: parsed.enabled === true, slides };
  } catch {
    return { enabled: false, slides: [] };
  }
}

export async function setHomeBannerSettings(settings: HomeBannerSettings) {
  const normalized: HomeBannerSettings = {
    enabled: settings.enabled === true,
    slides: settings.slides.map((slide) => ({
      id: slide.id,
      imageUrl: slide.imageUrl.trim(),
      title: slide.title.trim().slice(0, 90),
      subtitle: slide.subtitle.trim().slice(0, 120),
      href: slide.href.trim().slice(0, 240),
    })),
  };
  const value = JSON.stringify(normalized);

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: HOME_BANNER_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: HOME_BANNER_SETTINGS_KEY,
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
  const authType = value?.smtpAuthType === "microsoft_oauth2" ? "microsoft_oauth2" : "password";
  return {
    smtpHost: String(value?.smtpHost || "").trim(),
    smtpPort: port,
    smtpUser: String(value?.smtpUser || "").trim(),
    smtpFrom: String(value?.smtpFrom || "").trim(),
    smtpReplyTo: String(value?.smtpReplyTo || "").trim(),
    smtpAuthType: authType,
    smtpMicrosoftClientId: String(value?.smtpMicrosoftClientId || "").trim(),
    smtpMicrosoftTenantId: String(value?.smtpMicrosoftTenantId || "common").trim() || "common",
    encryptedSmtpPass: String(value?.encryptedSmtpPass || "").trim() || undefined,
    encryptedMicrosoftClientSecret: String(value?.encryptedMicrosoftClientSecret || "").trim() || undefined,
    encryptedMicrosoftRefreshToken: String(value?.encryptedMicrosoftRefreshToken || "").trim() || undefined,
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
  if (
    stored?.smtpAuthType === "microsoft_oauth2" &&
    stored.smtpUser &&
    stored.smtpMicrosoftClientId &&
    stored.encryptedMicrosoftClientSecret &&
    stored.encryptedMicrosoftRefreshToken
  ) {
    const clientSecret = decryptSecret(stored.encryptedMicrosoftClientSecret);
    const refreshToken = decryptSecret(stored.encryptedMicrosoftRefreshToken);
    if (clientSecret && refreshToken) {
      return {
        authType: "microsoft_oauth2",
        host: stored.smtpHost || "smtp.office365.com",
        port: Number(stored.smtpPort || "587"),
        user: stored.smtpUser,
        from: stored.smtpFrom || stored.smtpUser,
        replyTo: stored.smtpReplyTo || undefined,
        clientId: stored.smtpMicrosoftClientId,
        clientSecret,
        refreshToken,
        tenantId: stored.smtpMicrosoftTenantId || "common",
        source: "admin",
      };
    }
  }

  if (stored?.smtpHost && stored.smtpUser && stored.encryptedSmtpPass) {
    const pass = decryptSecret(stored.encryptedSmtpPass);
    if (pass) {
      return {
        authType: "password",
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
    authType: "password",
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
  smtpAuthType?: "password" | "microsoft_oauth2";
  smtpPass?: string;
  smtpMicrosoftClientId?: string;
  smtpMicrosoftTenantId?: string;
  smtpMicrosoftClientSecret?: string;
  smtpMicrosoftRefreshToken?: string;
}) {
  const current = await getStoredMailingSmtpSettings();
  const smtpPass = String(settings.smtpPass || "").trim();
  const microsoftClientSecret = String(settings.smtpMicrosoftClientSecret || "").trim();
  const microsoftRefreshToken = String(settings.smtpMicrosoftRefreshToken || "").trim();
  const hasNewSecret = Boolean(smtpPass || microsoftClientSecret || microsoftRefreshToken);

  if (hasNewSecret && !canEncryptMailingSecrets()) {
    throw new Error("MAILING_ENCRYPTION_KEY missing");
  }

  const value = normalizeSmtpSettings({
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpFrom: settings.smtpFrom,
    smtpReplyTo: settings.smtpReplyTo,
    smtpAuthType: settings.smtpAuthType,
    smtpMicrosoftClientId: settings.smtpMicrosoftClientId,
    smtpMicrosoftTenantId: settings.smtpMicrosoftTenantId,
    encryptedSmtpPass: smtpPass ? encryptSecret(smtpPass) : current?.encryptedSmtpPass,
    encryptedMicrosoftClientSecret: microsoftClientSecret
      ? encryptSecret(microsoftClientSecret)
      : current?.encryptedMicrosoftClientSecret,
    encryptedMicrosoftRefreshToken: microsoftRefreshToken
      ? encryptSecret(microsoftRefreshToken)
      : current?.encryptedMicrosoftRefreshToken,
  });

  const hasPublicConfig = Boolean(
    value.smtpHost ||
    value.smtpUser ||
    value.smtpFrom ||
    value.smtpReplyTo ||
    value.smtpMicrosoftClientId
  );
  if (!hasPublicConfig && !hasNewSecret) {
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

export async function getMailingMicrosoftOAuthCredentials() {
  const stored = await getStoredMailingSmtpSettings();
  if (!stored?.smtpMicrosoftClientId || !stored.encryptedMicrosoftClientSecret) return null;

  return {
    smtpUser: stored.smtpUser,
    smtpFrom: stored.smtpFrom,
    smtpReplyTo: stored.smtpReplyTo,
    smtpHost: stored.smtpHost || "smtp.office365.com",
    smtpPort: stored.smtpPort || "587",
    clientId: stored.smtpMicrosoftClientId,
    clientSecret: decryptSecret(stored.encryptedMicrosoftClientSecret),
    tenantId: stored.smtpMicrosoftTenantId || "common",
  };
}

export async function disconnectMailingMicrosoftOAuth() {
  const current = await getStoredMailingSmtpSettings();
  if (!current) return null;

  const value = normalizeSmtpSettings({
    ...current,
    encryptedMicrosoftRefreshToken: undefined,
  });

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
  const hasAdminMicrosoftOAuth2 = Boolean(
    storedSmtp?.smtpAuthType === "microsoft_oauth2" &&
    storedSmtp.smtpUser &&
    storedSmtp.smtpMicrosoftClientId &&
    storedSmtp.encryptedMicrosoftClientSecret &&
    storedSmtp.encryptedMicrosoftRefreshToken
  );
  const hasAdminPasswordSmtp = Boolean(storedSmtp?.smtpHost && storedSmtp.smtpUser && storedSmtp.encryptedSmtpPass);
  const smtpSource = hasAdminMicrosoftOAuth2 || hasAdminPasswordSmtp
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
    smtpAuthType: storedSmtp?.smtpAuthType || "password",
    smtpMicrosoftClientId: storedSmtp?.smtpMicrosoftClientId || "",
    smtpMicrosoftTenantId: storedSmtp?.smtpMicrosoftTenantId || "common",
    smtpMicrosoftClientSecretConfigured: Boolean(storedSmtp?.encryptedMicrosoftClientSecret),
    smtpMicrosoftRefreshTokenConfigured: Boolean(storedSmtp?.encryptedMicrosoftRefreshToken),
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

function normalizeManualPaymentMethods(input: unknown): ManualPaymentMethodSettings[] {
  const byKey = new Map<ManualPaymentMethodKey, ManualPaymentMethodSettings>(
    DEFAULT_MANUAL_PAYMENT_METHODS.map((method) => [method.key, method]),
  );
  const raw = Array.isArray(input) ? input : [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const method = item as Partial<ManualPaymentMethodSettings>;
    if (method.key !== "agreement" && method.key !== "cash" && method.key !== "transfer") continue;
    const current = byKey.get(method.key);
    if (!current) continue;
    const rawBankDetails = method.bankDetails;
    const bankDetails = rawBankDetails && typeof rawBankDetails === "object"
      ? {
          accountNumber: String(rawBankDetails.accountNumber || "").trim().slice(0, 100),
          cbu: String(rawBankDetails.cbu || "").trim().slice(0, 100),
          alias: String(rawBankDetails.alias || "").trim().slice(0, 100),
          holder: String(rawBankDetails.holder || "").trim().slice(0, 120),
          taxId: String(rawBankDetails.taxId || "").trim().slice(0, 100),
          accountType: String(rawBankDetails.accountType || "").trim().slice(0, 100),
          bank: String(rawBankDetails.bank || "").trim().slice(0, 160),
        }
      : current.bankDetails;
    byKey.set(method.key, {
      ...current,
      enabled: method.enabled === true,
      instructions: String(method.instructions || "").trim().slice(0, 500) || current.instructions,
      ...(method.key === "transfer" ? { bankDetails } : {}),
    });
  }

  return DEFAULT_MANUAL_PAYMENT_METHODS.map((method) => byKey.get(method.key) || method);
}

export async function getManualPaymentSettings(): Promise<ManualPaymentMethodSettings[]> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MANUAL_PAYMENT_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return DEFAULT_MANUAL_PAYMENT_METHODS;

  try {
    return normalizeManualPaymentMethods(JSON.parse(row.value));
  } catch {
    return DEFAULT_MANUAL_PAYMENT_METHODS;
  }
}

export async function setManualPaymentSettings(methods: unknown) {
  const value = JSON.stringify(normalizeManualPaymentMethods(methods));

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: MANUAL_PAYMENT_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: MANUAL_PAYMENT_SETTINGS_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
      isSecret: false,
    },
  });
}

function normalizePaymentFinancingDisplaySettings(input: unknown): PaymentFinancingDisplaySettings {
  if (!input || typeof input !== "object") return DEFAULT_PAYMENT_FINANCING_DISPLAY_SETTINGS;
  const value = input as Partial<PaymentFinancingDisplaySettings>;
  const manualMethods: Partial<Record<ManualPaymentMethodKey, boolean>> =
    value.manualMethods && typeof value.manualMethods === "object"
    ? value.manualMethods
    : {};
  const merchantOptions = value.merchantOptions && typeof value.merchantOptions === "object"
    ? value.merchantOptions as Partial<PaymentFinancingDisplaySettings["merchantOptions"]>
    : {};
  const merchantManualMethods: Partial<Record<ManualPaymentMethodKey, boolean>> = merchantOptions.manualMethods && typeof merchantOptions.manualMethods === "object"
    ? merchantOptions.manualMethods as Partial<Record<ManualPaymentMethodKey, boolean>>
    : {};

  return {
    goCuotas: value.goCuotas !== false,
    mercadopago: value.mercadopago !== false,
    merchantCanSee: value.merchantCanSee !== false,
    merchantOptions: {
      goCuotas: merchantOptions.goCuotas !== false,
      mercadopago: merchantOptions.mercadopago !== false,
      manualMethods: {
        agreement: merchantManualMethods.agreement !== false,
        cash: merchantManualMethods.cash !== false,
        transfer: merchantManualMethods.transfer !== false,
      },
    },
    manualMethods: {
      agreement: manualMethods.agreement !== false,
      cash: manualMethods.cash !== false,
      transfer: manualMethods.transfer !== false,
    },
  };
}

export async function getPaymentFinancingDisplaySettings(): Promise<PaymentFinancingDisplaySettings> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: PAYMENT_FINANCING_DISPLAY_SETTINGS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return DEFAULT_PAYMENT_FINANCING_DISPLAY_SETTINGS;

  try {
    return normalizePaymentFinancingDisplaySettings(JSON.parse(row.value));
  } catch {
    return DEFAULT_PAYMENT_FINANCING_DISPLAY_SETTINGS;
  }
}

export async function setPaymentFinancingDisplaySettings(settings: unknown) {
  const value = JSON.stringify(normalizePaymentFinancingDisplaySettings(settings));

  return prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: PAYMENT_FINANCING_DISPLAY_SETTINGS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: PAYMENT_FINANCING_DISPLAY_SETTINGS_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
      isSecret: false,
    },
  });
}

function normalizeInstallmentPlans(input: unknown): InstallmentPlan[] {
  if (!Array.isArray(input)) return DEFAULT_INSTALLMENT_PLANS;
  const plans = input
    .map((item) => {
      const value = item as Partial<InstallmentPlan>;
      return {
        installments: Math.max(1, Math.min(24, Math.floor(Number(value?.installments) || 0))),
        minimumAmount: Math.max(0, Math.floor(Number(value?.minimumAmount) || 0)),
      };
    })
    .filter((item) => item.installments > 0);
  return plans.length > 0 ? plans : DEFAULT_INSTALLMENT_PLANS;
}

export async function getInstallmentPlans(): Promise<InstallmentPlan[]> {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: { provider_key: { provider: STOREFRONT_SETTINGS_PROVIDER, key: INSTALLMENT_PLANS_SETTINGS_KEY } },
    select: { value: true },
  });
  if (!row?.value) return DEFAULT_INSTALLMENT_PLANS;
  try {
    return normalizeInstallmentPlans(JSON.parse(row.value));
  } catch {
    return DEFAULT_INSTALLMENT_PLANS;
  }
}

export async function setInstallmentPlans(settings: unknown) {
  return prisma.shippingProviderSetting.upsert({
    where: { provider_key: { provider: STOREFRONT_SETTINGS_PROVIDER, key: INSTALLMENT_PLANS_SETTINGS_KEY } },
    create: { provider: STOREFRONT_SETTINGS_PROVIDER, key: INSTALLMENT_PLANS_SETTINGS_KEY, value: JSON.stringify(normalizeInstallmentPlans(settings)), isSecret: false },
    update: { value: JSON.stringify(normalizeInstallmentPlans(settings)), isSecret: false },
  });
}

export async function getCheckoutPaymentSettings(): Promise<CheckoutPaymentSettings> {
  const [mercadoPagoSettings, manualMethods, financingDisplay, installmentPlans] = await Promise.all([
    getMercadoPagoSettings(),
    getManualPaymentSettings(),
    getPaymentFinancingDisplaySettings(),
    getInstallmentPlans(),
  ]);

  return {
    mercadopagoEnabled: mercadoPagoSettings.accessTokenConfigured,
    manualMethods,
    financingDisplay,
    installmentPlans,
  };
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
