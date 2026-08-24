"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  CreditCard,
  Eye,
  FileText,
  Globe,
  GripVertical,
  Home,
  ImageIcon,
  LayoutGrid,
  LinkIcon,
  Monitor,
  Paintbrush,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Share2,
  Store,
  Tag,
  Truck,
  Trash2,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { sanitizeRichText } from "@/lib/richText";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  label?: string;
};

type HomeCategoryTile = {
  id: string;
  categoryId: string;
  categorySlug: string;
  title: string;
  imageUrl: string;
};

type HomeBannerSlide = {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  href: string;
};

type HomeBannerSettings = {
  enabled: boolean;
  slides: HomeBannerSlide[];
};

type InformationSection = {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
};

type TemporaryShutdownSettings = {
  isShutdown: boolean;
  message: string;
};

type MercadoPagoSettings = {
  accessTokenConfigured: boolean;
  source: "oauth" | "manual" | "env" | "none";
  connectedUserId?: string;
  expiresAt?: string;
};

type ManualPaymentMethodKey = "agreement" | "cash" | "transfer";

type ManualPaymentMethodSettings = {
  key: ManualPaymentMethodKey;
  label: string;
  enabled: boolean;
  instructions: string;
  bankDetails?: {
    accountNumber: string;
    cbu: string;
    alias: string;
    holder: string;
    taxId: string;
    accountType: string;
    bank: string;
  };
};

type PaymentFinancingDisplaySettings = {
  goCuotas: boolean;
  mercadopago: boolean;
  manualMethods: Record<ManualPaymentMethodKey, boolean>;
};

type AnalyticsSettings = {
  googleAnalyticsMeasurementId: string;
  metaPixelId: string;
};

type SocialLinksSettings = {
  facebook: string;
  instagram: string;
  tiktok: string;
};

const EMPTY_SOCIAL_LINKS: SocialLinksSettings = {
  facebook: "",
  instagram: "",
  tiktok: "",
};

type DomainStatus = "NOT_CONFIGURED" | "PENDING" | "VERIFIED" | "ACTIVE" | "ERROR";

type CustomDomainSettings = {
  customDomain: string;
  domainStatus: DomainStatus;
  domainVerifiedAt: string | null;
  domainActivatedAt: string | null;
  errorMessage: string | null;
  dnsTarget: string;
  serverIps: string[];
  supportsARecord: boolean;
};

type BrowserCryptoWithUuid = Crypto & {
  randomUUID?: () => string;
};

type SettingsTab = "appearance" | "home" | "content" | "pages" | "categories" | "payments" | "social" | "domain" | "analytics";

const tabs: { key: SettingsTab; label: string; icon: LucideIcon }[] = [
  { key: "appearance", label: "Apariencia", icon: Paintbrush },
  { key: "home", label: "Inicio", icon: Home },
  { key: "content", label: "Contenido", icon: Monitor },
  { key: "pages", label: "Páginas", icon: FileText },
  { key: "categories", label: "Categorías", icon: LayoutGrid },
  { key: "payments", label: "Medios de pago", icon: CreditCard },
  { key: "social", label: "Redes", icon: Share2 },
  { key: "domain", label: "Dominio", icon: Globe },
  { key: "analytics", label: "Analíticas", icon: BarChart3 },
];

const ANNOUNCEMENT_ICONS: LucideIcon[] = [CreditCard, Tag, Truck];

function normalizeAnnouncementBenefit(text: string, index: number) {
  const clean = text.trim();
  const upper = clean.toUpperCase();

  if (upper.includes("CUOTA")) {
    return {
      title: "3 CUOTAS SIN INTERÉS",
      subtitle: upper.includes("$50") ? "desde $50.000" : clean.replace(/3\s*cuotas\s*sin\s*inter[eé]s/i, "").trim(),
      Icon: ANNOUNCEMENT_ICONS[index] || CreditCard,
    };
  }

  if (upper.includes("15%") || upper.includes("OFF")) {
    return {
      title: "15% OFF",
      subtitle: "transferencia o efectivo",
      Icon: ANNOUNCEMENT_ICONS[index] || Tag,
    };
  }

  if (upper.includes("ENV")) {
    return {
      title: "ENVÍO GRATIS",
      subtitle: upper.includes("SUCURSAL") ? "a sucursal desde $43.000" : clean.replace(/env[ií]os?\s*gratis/i, "").trim(),
      Icon: ANNOUNCEMENT_ICONS[index] || Truck,
    };
  }

  const [title, ...rest] = clean.split(/\s+-\s+|\s{2,}/);
  return {
    title: title || `Beneficio ${index + 1}`,
    subtitle: rest.join(" ").trim(),
    Icon: ANNOUNCEMENT_ICONS[index] || Tag,
  };
}

function getAnnouncementBenefits(text: string) {
  const clean = text.trim() || "3 CUOTAS SIN INTERÉS desde $50.000 | 15% OFF transferencia o efectivo | ENVÍO GRATIS a sucursal desde $43.000";
  return clean
    .split("|")
    .map((part, index) => normalizeAnnouncementBenefit(part, index))
    .slice(0, 3);
}

function getAnnouncementParts(text: string) {
  const defaults = [
    "3 CUOTAS SIN INTERÉS desde $50.000",
    "15% OFF transferencia o efectivo",
    "ENVÍO GRATIS a sucursal desde $43.000",
  ];
  const parts = text.split("|").map((part) => part.trim());
  return defaults.map((fallback, index) => parts[index] || fallback);
}

function patchAnnouncementPart(text: string, index: number, value: string) {
  const parts = getAnnouncementParts(text);
  parts[index] = value;
  return parts.map((part) => part.trim()).filter(Boolean).join(" | ");
}

function createClientId() {
  const browserCrypto = globalThis.crypto as BrowserCryptoWithUuid | undefined;

  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function AdminSettingsPage({
  announcementText,
  logoUrl,
  homeBannerSettings,
  homeCategoryTiles,
  siteTitle,
  faviconUrl,
  temporaryShutdown,
  mercadoPagoSettings,
  manualPaymentMethods,
  paymentFinancingDisplaySettings,
  analyticsSettings,
  socialLinksSettings,
  customDomainSettings,
  currentUserRole,
  informationSections,
  categories,
}: {
  announcementText: string;
  logoUrl: string;
  homeBannerSettings: HomeBannerSettings;
  homeCategoryTiles: HomeCategoryTile[];
  siteTitle: string;
  faviconUrl: string;
  temporaryShutdown: TemporaryShutdownSettings;
  mercadoPagoSettings: MercadoPagoSettings;
  manualPaymentMethods: ManualPaymentMethodSettings[];
  paymentFinancingDisplaySettings: PaymentFinancingDisplaySettings;
  analyticsSettings: AnalyticsSettings;
  socialLinksSettings?: SocialLinksSettings;
  customDomainSettings: CustomDomainSettings;
  currentUserRole: string;
  informationSections: InformationSection[];
  categories: CategoryOption[];
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") as SettingsTab | null;
  const initialTab = requestedTab && tabs.some((tab) => tab.key === requestedTab) ? requestedTab : "appearance";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [text, setText] = useState(announcementText);
  const [logo, setLogo] = useState(logoUrl);
  const [title, setTitle] = useState(siteTitle);
  const [favicon, setFavicon] = useState(faviconUrl);
  const [shutdownEnabled, setShutdownEnabled] = useState(temporaryShutdown.isShutdown);
  const [shutdownMessage, setShutdownMessage] = useState(temporaryShutdown.message);
  const [mpAccessToken, setMpAccessToken] = useState("");
  const [mpSettings, setMpSettings] = useState(mercadoPagoSettings);
  const [manualMethods, setManualMethods] = useState(manualPaymentMethods);
  const [financingDisplay, setFinancingDisplay] = useState(paymentFinancingDisplaySettings);
  const [gaMeasurementId, setGaMeasurementId] = useState(analyticsSettings.googleAnalyticsMeasurementId);
  const [metaPixelId, setMetaPixelId] = useState(analyticsSettings.metaPixelId);
  const [socialLinks, setSocialLinks] = useState<SocialLinksSettings>(socialLinksSettings ?? EMPTY_SOCIAL_LINKS);
  const [domainSettings, setDomainSettings] = useState(customDomainSettings);
  const [customDomain, setCustomDomain] = useState(customDomainSettings.customDomain);
  const [homeBanner, setHomeBanner] = useState<HomeBannerSettings>(homeBannerSettings);
  const [tiles, setTiles] = useState<HomeCategoryTile[]>(homeCategoryTiles);
  const [sections, setSections] = useState<InformationSection[]>(informationSections);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [faviconLoading, setFaviconLoading] = useState(false);
  const [shutdownLoading, setShutdownLoading] = useState(false);
  const [mpLoading, setMpLoading] = useState(false);
  const [manualPaymentsLoading, setManualPaymentsLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [socialLinksLoading, setSocialLinksLoading] = useState(false);
  const [domainLoading, setDomainLoading] = useState(false);
  const [domainVerifyLoading, setDomainVerifyLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);

  useEffect(() => {
    if (requestedTab && tabs.some((tab) => tab.key === requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab]);
  const [homeBannerLoading, setHomeBannerLoading] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [browserMsg, setBrowserMsg] = useState<string | null>(null);
  const [shutdownMsg, setShutdownMsg] = useState<string | null>(null);
  const [mpMsg, setMpMsg] = useState<string | null>(null);
  const [manualPaymentsMsg, setManualPaymentsMsg] = useState<string | null>(null);
  const [analyticsMsg, setAnalyticsMsg] = useState<string | null>(null);
  const [socialLinksMsg, setSocialLinksMsg] = useState<string | null>(null);
  const [domainMsg, setDomainMsg] = useState<string | null>(null);
  const [homeBannerMsg, setHomeBannerMsg] = useState<string | null>(null);
  const [tileMsg, setTileMsg] = useState<string | null>(null);
  const [sectionsMsg, setSectionsMsg] = useState<string | null>(null);
  const informationContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!informationContentRef.current || !editingSectionId) return;
    const section = sections.find((item) => item.id === editingSectionId);
    informationContentRef.current.innerHTML = sanitizeRichText(section?.content);
    // The editor should load content only when opening/switching pages, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSectionId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("mp_oauth");
    if (!oauthStatus) return;

    setActiveTab("payments");
    const messages: Record<string, string> = {
      connected: "Cuenta de MercadoPago conectada.",
      denied: "No se autorizó la conexión con MercadoPago.",
      forbidden: "No tenés permisos para conectar MercadoPago.",
      invalid_state: "La conexión venció. Intentá conectar MercadoPago nuevamente.",
      missing_client_id: "Falta configurar MP_OAUTH_CLIENT_ID en el servidor.",
      missing_credentials: "OAuth no está disponible: faltan MP_OAUTH_CLIENT_ID y MP_OAUTH_CLIENT_SECRET en el servidor. MP_ACCESS_TOKEN solo mantiene activo el checkout actual.",
      token_error: "MercadoPago no pudo validar la autorización. Revisá que la URL de redirección configurada en Developers coincida exactamente con la de esta tienda.",
      save_error: "No se pudo guardar la conexión de MercadoPago.",
    };

    setMpMsg(messages[oauthStatus] || "No se pudo completar la conexión de MercadoPago.");
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function saveBrowserTitle() {
    setBrowserMsg(null);
    setBrowserLoading(true);

    const res = await fetch("/api/admin/settings/browser", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteTitle: title }),
    });

    const data = await res.json().catch(() => ({}));
    setBrowserLoading(false);

    if (!res.ok) {
      setBrowserMsg(String(data?.error || "No se pudo guardar."));
      return;
    }

    setTitle(data.siteTitle);
    setBrowserMsg("Titulo de pestana guardado.");
  }

  async function uploadFavicon(file: File) {
    setBrowserMsg(null);
    setFaviconLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/settings/favicon", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    setFaviconLoading(false);

    if (!res.ok) {
      setBrowserMsg(String(data?.error || "No se pudo subir el favicon."));
      return;
    }

    setFavicon(data.faviconUrl);
    setBrowserMsg("Favicon actualizado.");
  }

  async function saveTemporaryShutdown(nextEnabled = shutdownEnabled) {
    setShutdownMsg(null);
    setShutdownLoading(true);

    const res = await fetch("/api/admin/settings/temporary-shutdown", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isShutdown: nextEnabled,
        message: shutdownMessage,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setShutdownLoading(false);

    if (!res.ok) {
      setShutdownMsg(String(data?.error || "No se pudo guardar el estado de la tienda."));
      return;
    }

    setShutdownEnabled(data.isShutdown === true);
    setShutdownMessage(String(data.message || ""));
    setShutdownMsg(data.isShutdown ? "Tienda apagada temporalmente." : "Tienda encendida.");
  }

  async function saveMercadoPagoSettings() {
    setMpMsg(null);
    setMpLoading(true);

    const res = await fetch("/api/admin/settings/mercadopago", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: mpAccessToken }),
    });

    const data = await res.json().catch(() => ({}));
    setMpLoading(false);

    if (!res.ok) {
      setMpMsg(String(data?.error || "No se pudo guardar MercadoPago."));
      return;
    }

    setMpSettings(data.settings);
    setMpAccessToken("");
    setMpMsg("Cuenta de MercadoPago guardada.");
  }

  async function disconnectMercadoPago() {
    setMpMsg(null);
    setMpLoading(true);

    const res = await fetch("/api/admin/settings/mercadopago", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setMpLoading(false);

    if (!res.ok) {
      setMpMsg(String(data?.error || "No se pudo desconectar MercadoPago."));
      return;
    }

    setMpSettings(data.settings);
    setMpAccessToken("");
    setMpMsg("MercadoPago desconectado.");
  }

  function patchManualMethod(key: ManualPaymentMethodKey, patch: Partial<ManualPaymentMethodSettings>) {
    setManualMethods((prev) => prev.map((method) => (method.key === key ? { ...method, ...patch } : method)));
  }

  function patchTransferBankDetail(key: keyof NonNullable<ManualPaymentMethodSettings["bankDetails"]>, value: string) {
    setManualMethods((prev) => prev.map((method) => method.key === "transfer"
      ? { ...method, bankDetails: { ...method.bankDetails, [key]: value } as NonNullable<ManualPaymentMethodSettings["bankDetails"]> }
      : method));
  }

  function patchFinancingManualMethod(key: ManualPaymentMethodKey, visible: boolean) {
    setFinancingDisplay((prev) => ({
      ...prev,
      manualMethods: { ...prev.manualMethods, [key]: visible },
    }));
  }

  async function saveManualPaymentMethods() {
    setManualPaymentsMsg(null);
    setManualPaymentsLoading(true);

    const res = await fetch("/api/admin/settings/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methods: manualMethods, financingDisplay }),
    });
    const data = await res.json().catch(() => ({}));
    setManualPaymentsLoading(false);

    if (!res.ok) {
      setManualPaymentsMsg(String(data?.error || "No se pudieron guardar los medios de pago manuales."));
      return;
    }

    setManualMethods(data.methods || []);
    if (data.financingDisplay) setFinancingDisplay(data.financingDisplay);
    setManualPaymentsMsg("Medios de pago guardados.");
  }

  async function saveSocialLinksSettings() {
    setSocialLinksMsg(null);
    setSocialLinksLoading(true);

    const res = await fetch("/api/admin/settings/social-links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(socialLinks),
    });

    const data = await res.json().catch(() => ({}));
    setSocialLinksLoading(false);

    if (!res.ok) {
      setSocialLinksMsg(String(data?.error || "No se pudieron guardar las redes sociales."));
      return;
    }

    setSocialLinks(data.settings || { facebook: "", instagram: "", tiktok: "" });
    setSocialLinksMsg("Redes sociales guardadas.");
  }

  async function saveAnalyticsSettings() {
    setAnalyticsMsg(null);
    setAnalyticsLoading(true);

    const res = await fetch("/api/admin/settings/analytics", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleAnalyticsMeasurementId: gaMeasurementId, metaPixelId }),
    });

    const data = await res.json().catch(() => ({}));
    setAnalyticsLoading(false);

    if (!res.ok) {
      setAnalyticsMsg(String(data?.error || "No se pudo guardar analíticas."));
      return;
    }

    setGaMeasurementId(data.settings?.googleAnalyticsMeasurementId || "");
    setMetaPixelId(data.settings?.metaPixelId || "");
    setAnalyticsMsg("Configuración de analíticas guardada.");
  }

  async function saveCustomDomainSettings() {
    setDomainMsg(null);

    if (
      domainSettings.domainStatus === "ACTIVE" &&
      domainSettings.customDomain &&
      customDomain.trim() !== domainSettings.customDomain
    ) {
      const confirmed = window.confirm(
        "Este dominio está activo. Si lo reemplazás, el nuevo dominio quedará pendiente hasta verificar DNS y activar HTTPS en el servidor.",
      );
      if (!confirmed) return;
    }

    setDomainLoading(true);
    const res = await fetch("/api/admin/settings/domain", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customDomain }),
    });

    const data = await res.json().catch(() => ({}));
    setDomainLoading(false);

    if (!res.ok) {
      setDomainMsg(String(data?.error || "No se pudo guardar el dominio."));
      return;
    }

    setDomainSettings(data.settings);
    setCustomDomain(data.settings?.customDomain || "");
    setDomainMsg("Dominio guardado. Ahora verificá la configuración DNS.");
  }

  async function verifyCustomDomainSettings() {
    setDomainMsg(null);
    setDomainVerifyLoading(true);

    const res = await fetch("/api/admin/settings/domain", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setDomainVerifyLoading(false);

    if (!res.ok) {
      setDomainMsg(String(data?.error || "No se pudo verificar DNS."));
      return;
    }

    setDomainSettings(data.settings);
    setCustomDomain(data.settings?.customDomain || "");
    setDomainMsg(
      data.settings?.domainStatus === "VERIFIED"
        ? "DNS configurado correctamente. Falta activar HTTPS en el servidor."
        : data.settings?.domainStatus === "ERROR"
          ? "La verificación encontró un problema. Revisá el detalle del estado."
          : "Todavía no vemos la configuración DNS correcta. Puede demorar unos minutos en propagarse.",
    );
  }

  async function save() {
    setMsg(null);
    setLoading(true);

    const res = await fetch("/api/admin/settings/announcement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo guardar."));
      return;
    }

    setText(data.text);
    setMsg("Texto guardado.");
  }

  async function uploadLogo(file: File) {
    setMsg(null);
    setLogoLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/settings/logo", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    setLogoLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo subir el logo."));
      return;
    }

    setLogo(data.logoUrl);
    setMsg("Logo actualizado.");
  }

  function addHomeBannerSlide() {
    setHomeBannerMsg(null);
    setHomeBanner((prev) => ({
      ...prev,
      slides: [
        ...prev.slides,
        {
          id: createClientId(),
          imageUrl: "",
          title: "",
          subtitle: "",
          href: "",
        },
      ],
    }));
  }

  function patchHomeBannerSlide(id: string, patch: Partial<HomeBannerSlide>) {
    setHomeBanner((prev) => ({
      ...prev,
      slides: prev.slides.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    }));
  }

  function removeHomeBannerSlide(id: string) {
    setHomeBannerMsg(null);
    setHomeBanner((prev) => ({
      ...prev,
      slides: prev.slides.filter((slide) => slide.id !== id),
    }));
  }

  async function uploadHomeBannerImage(id: string, file: File) {
    setHomeBannerMsg(null);
    setHomeBannerLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/settings/home-categories/image", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    setHomeBannerLoading(false);

    if (!res.ok) {
      setHomeBannerMsg(String(data?.error || "No se pudo subir la imagen."));
      return;
    }

    patchHomeBannerSlide(id, { imageUrl: data.imageUrl });
    setHomeBannerMsg("Imagen cargada. Ahora guarda el banner.");
  }

  async function saveHomeBanner() {
    setHomeBannerMsg(null);

    const missingImage = homeBanner.slides.find((slide) => !slide.imageUrl.trim());
    if (missingImage) {
      setHomeBannerMsg("Falta subir una imagen en uno de los banners.");
      return;
    }

    setHomeBannerLoading(true);

    const res = await fetch("/api/admin/settings/home-banner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(homeBanner),
    });

    const data = await res.json().catch(() => ({}));
    setHomeBannerLoading(false);

    if (!res.ok) {
      setHomeBannerMsg(String(data?.error || "No se pudo guardar el banner."));
      return;
    }

    setHomeBanner(data.settings || { enabled: false, slides: [] });
    setHomeBannerMsg("Banner guardado.");
  }

  function addTile() {
    setTileMsg(null);
    const category = categories[0];
    if (!category) {
      setTileMsg("Primero crea una categoria.");
      return;
    }

    setTiles((prev) => [
      ...prev,
      {
        id: createClientId(),
        categoryId: category.id,
        categorySlug: category.slug,
        title: category.name,
        imageUrl: "",
      },
    ]);
  }

  function patchTile(id: string, patch: Partial<HomeCategoryTile>) {
    setTiles((prev) => prev.map((tile) => (tile.id === id ? { ...tile, ...patch } : tile)));
  }

  async function uploadTileImage(id: string, file: File) {
    setTileMsg(null);
    setTilesLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/settings/home-categories/image", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    setTilesLoading(false);

    if (!res.ok) {
      setTileMsg(String(data?.error || "No se pudo subir la imagen."));
      return;
    }

    patchTile(id, { imageUrl: data.imageUrl });
    setTileMsg("Imagen cargada. Ahora guarda las categorias destacadas.");
  }

  async function saveTiles() {
    setTileMsg(null);

    const missingImage = tiles.find((tile) => !tile.imageUrl.trim());
    if (missingImage) {
      setTileMsg("Falta subir una imagen en una de las categorias destacadas.");
      return;
    }

    setTilesLoading(true);

    const res = await fetch("/api/admin/settings/home-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiles }),
    });

    const data = await res.json().catch(() => ({}));
    setTilesLoading(false);

    if (!res.ok) {
      setTileMsg(String(data?.error || "No se pudieron guardar las categorias destacadas."));
      return;
    }

    setTiles(data.tiles || []);
    setTileMsg("Categorias destacadas guardadas.");
  }

  function addSection() {
    setSectionsMsg(null);
    const title = "Nueva seccion";
    const id = createClientId();
    setSections((prev) => [
      ...prev,
      {
        id,
        title,
        slug: `${slugify(title)}-${prev.length + 1}`,
        content: "",
        isActive: true,
      },
    ]);
    setEditingSectionId(id);
  }

  function patchSection(id: string, patch: Partial<InformationSection>) {
    setSections((prev) => prev.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  function setAllSectionsActive(isActive: boolean) {
    setSections((prev) => prev.map((section) => ({ ...section, isActive })));
  }

  function moveSection(fromId: string, toId: string) {
    if (fromId === toId) return;

    setSections((prev) => {
      const fromIndex = prev.findIndex((section) => section.id === fromId);
      const toIndex = prev.findIndex((section) => section.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function syncInformationContentFromEditor() {
    if (!editingSectionId) return;
    patchSection(editingSectionId, {
      content: sanitizeRichText(informationContentRef.current?.innerHTML ?? ""),
    });
  }

  function formatInformationContent(command: string, value?: string) {
    informationContentRef.current?.focus();
    document.execCommand(command, false, value);
    syncInformationContentFromEditor();
  }

  function addInformationLink() {
    const url = window.prompt("URL del enlace");
    if (!url?.trim()) return;
    formatInformationContent("createLink", url.trim());
  }

  async function uploadInformationImage(file: File) {
    setSectionsMsg(null);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/uploads/image", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) {
      setSectionsMsg(String(data?.error || "Error subiendo imagen para la pagina."));
      return;
    }

    informationContentRef.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${data.url}" alt="" loading="lazy"><br>`);
    syncInformationContentFromEditor();
  }

  async function saveSections() {
    setSectionsMsg(null);

    const missingTitle = sections.find((section) => !section.title.trim());
    if (missingTitle) {
      setSectionsMsg("Todas las secciones necesitan un titulo.");
      return;
    }

    setSectionsLoading(true);

    const res = await fetch("/api/admin/settings/information-sections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });

    const data = await res.json().catch(() => ({}));
    setSectionsLoading(false);

    if (!res.ok) {
      setSectionsMsg(String(data?.error || "No se pudieron guardar las secciones."));
      return;
    }

    setSections(data.sections || []);
    setSectionsMsg("Secciones de informacion guardadas.");
  }

  const editingSection = sections.find((section) => section.id === editingSectionId) ?? null;
  const sectionsEnabled = sections.some((section) => section.isActive);
  const canManageMercadoPagoOAuth = currentUserRole === "merchant";
  const canManageMercadoPagoManualToken = currentUserRole === "admin";

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#70471F]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#A37A55]">Centro de configuración</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#5F3B18]">Configuración</h1>
            <p className="mt-2 max-w-2xl text-base text-[#8F6A49]">
              Personalizá la apariencia y el contenido de tu tienda.
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#70471F]"
          >
            Ver tienda
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>

        <div className="mt-8 xl:mt-6 flex gap-2 overflow-x-auto rounded-3xl border border-[#E5D7C8] bg-white/70 p-2 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 xl:py-2 text-sm font-semibold transition duration-150",
                  active ? "bg-[#8B5A2B] text-white shadow-sm" : "text-[#7B522E] hover:bg-[#F2ECE5]",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "appearance" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <SectionCard title="Apariencia" description="Personalizá la identidad visual de tu tienda." icon={Paintbrush}>
                <div className="grid gap-5 xl:gap-4 lg:grid-cols-2">
                  <UploadCard
                    title="Logo"
                    description="Se muestra en el encabezado de la tienda. Recomendado PNG o SVG."
                    imageUrl={logo}
                    emptyTitle="Todavía no cargaste un logo."
                    emptyDescription="Subí una imagen PNG o SVG."
                    loading={logoLoading}
                    buttonLabel={logo ? "Cambiar imagen" : "Subir logo"}
                    accept="image/*"
                    onUpload={uploadLogo}
                    large
                  />

                  <UploadCard
                    title="Favicon"
                    description="Icono de la pestaña del navegador."
                    imageUrl={favicon}
                    emptyTitle="Todavía no cargaste un favicon."
                    emptyDescription="Subí una imagen cuadrada o .ico."
                    loading={faviconLoading}
                    buttonLabel={favicon ? "Cambiar favicon" : "Subir favicon"}
                    accept="image/*,.ico"
                    onUpload={uploadFavicon}
                  />
                </div>

                <div className="mt-6 xl:mt-4 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                  <FieldLabel label="Título de la pestaña" help="Este texto aparece en el título del navegador." />
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={80}
                    className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <PrimaryButton onClick={saveBrowserTitle} loading={browserLoading} label="Guardar título" />
                    <span className="text-xs text-[#A37A55]">{title.length}/80 caracteres</span>
                  </div>
                  {browserMsg ? <Notice>{browserMsg}</Notice> : null}
                </div>
              </SectionCard>
            </div>

            <StorePreview logo={logo} text={text} title={title} shutdownEnabled={shutdownEnabled} />
          </div>
        ) : null}

        {activeTab === "home" ? (
          <div className="mt-8 xl:mt-6 space-y-6 xl:space-y-4">
            <HomeBannerSection
              settings={homeBanner}
              loading={homeBannerLoading}
              message={homeBannerMsg}
              setEnabled={(enabled) => setHomeBanner((prev) => ({ ...prev, enabled }))}
              addSlide={addHomeBannerSlide}
              patchSlide={patchHomeBannerSlide}
              removeSlide={removeHomeBannerSlide}
              uploadSlideImage={uploadHomeBannerImage}
              save={saveHomeBanner}
            />
            <HomeTilesSection
              tiles={tiles}
              categories={categories}
              tilesLoading={tilesLoading}
              tileMsg={tileMsg}
              addTile={addTile}
              patchTile={patchTile}
              uploadTileImage={uploadTileImage}
              saveTiles={saveTiles}
              removeTile={(id) => setTiles((prev) => prev.filter((item) => item.id !== id))}
            />
          </div>
        ) : null}

        {activeTab === "content" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <SectionCard title="Contenido de inicio" description="Mensajes y estados visibles en la tienda." icon={Monitor}>
                <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                  <FieldLabel label="Banner superior" help="Utilizalo para promociones importantes o avisos de la tienda." />
                  <div className="mt-3 grid gap-3">
                    {getAnnouncementParts(text).map((part, index) => (
                      <label key={index} className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#A37A55]">
                          {index === 0 ? "Beneficio 1" : index === 1 ? "Beneficio 2" : "Beneficio 3"}
                        </span>
                        <input
                          value={part}
                          onChange={(e) => setText(patchAnnouncementPart(text, index, e.target.value))}
                          maxLength={160}
                          className="mt-1 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm leading-6 text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-[#E5D7C8]">
                    <AnnouncementPreview text={text} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <PrimaryButton onClick={save} loading={loading} label="Guardar banner" />
                    <span className="text-xs text-[#A37A55]">{text.length}/500 caracteres</span>
                  </div>
                  {msg ? <Notice>{msg}</Notice> : null}
                </div>
              </SectionCard>

              <SectionCard title="Estado de la tienda" description="Apagá temporalmente la tienda cuando no puedas administrarla." icon={Store}>
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge active={!shutdownEnabled} />
                      <span className="text-sm font-semibold text-[#5F3B18]">
                        {shutdownEnabled ? "Tienda apagada" : "Tienda activa"}
                      </span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#8F6A49]">
                      Mientras la tienda esté apagada no se podrán visualizar los productos. Podés definir un mensaje opcional para los visitantes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveTemporaryShutdown(!shutdownEnabled)}
                    disabled={shutdownLoading}
                    className={[
                      "rounded-2xl px-5 py-3 xl:py-2.5 text-sm font-semibold transition duration-150 disabled:opacity-50",
                      shutdownEnabled
                        ? "bg-[#8B5A2B] text-white hover:bg-[#70471F]"
                        : "border border-[#E5D7C8] text-[#8B5A2B] hover:bg-[#F2ECE5]",
                    ].join(" ")}
                  >
                    {shutdownLoading ? "Guardando..." : shutdownEnabled ? "Encender tienda" : "Apagar tienda"}
                  </button>
                </div>

                <div className="mt-5">
                  <FieldLabel label="Mensaje para mostrar en la tienda" help="Este texto se muestra cuando la tienda está apagada temporalmente." />
                  <textarea
                    value={shutdownMessage}
                    onChange={(e) => setShutdownMessage(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-3 xl:py-2.5 text-sm leading-6 text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <SecondaryButton onClick={() => saveTemporaryShutdown()} loading={shutdownLoading} label="Guardar mensaje" />
                    <span className="text-xs text-[#A37A55]">{shutdownMessage.length}/500 caracteres</span>
                  </div>
                  {shutdownMsg ? <Notice>{shutdownMsg}</Notice> : null}
                </div>
              </SectionCard>
            </div>

            <StorePreview logo={logo} text={text} title={title} shutdownEnabled={shutdownEnabled} />
          </div>
        ) : null}

        {activeTab === "pages" ? (
          <div className="mt-8 xl:mt-6">
            <PagesSection
              sections={sections}
              editingSection={editingSection}
              editingSectionId={editingSectionId}
              draggingSectionId={draggingSectionId}
              dragOverSectionId={dragOverSectionId}
              sectionsEnabled={sectionsEnabled}
              sectionsLoading={sectionsLoading}
              sectionsMsg={sectionsMsg}
              informationContentRef={informationContentRef}
              setDraggingSectionId={setDraggingSectionId}
              setDragOverSectionId={setDragOverSectionId}
              setEditingSectionId={setEditingSectionId}
              setSections={setSections}
              addSection={addSection}
              patchSection={patchSection}
              setAllSectionsActive={setAllSectionsActive}
              moveSection={moveSection}
              formatInformationContent={formatInformationContent}
              addInformationLink={addInformationLink}
              uploadInformationImage={uploadInformationImage}
              syncInformationContentFromEditor={syncInformationContentFromEditor}
              saveSections={saveSections}
            />
          </div>
        ) : null}

        {activeTab === "payments" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard title="Medios de pago" description="Configurá las credenciales para cobrar pedidos online." icon={CreditCard}>
              <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge active={mpSettings.accessTokenConfigured} />
                      <span className="text-sm font-semibold text-[#5F3B18]">
                        {mpSettings.accessTokenConfigured ? "MercadoPago configurado" : "MercadoPago sin configurar"}
                      </span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#8F6A49]">
                      Usá el Access Token de tu cuenta para crear preferencias de pago y validar notificaciones.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#E5D7C8] bg-white/70 px-3 py-1 text-xs font-semibold text-[#8B5A2B]">
                    {mpSettings.source === "oauth"
                      ? "OAuth"
                      : mpSettings.source === "manual"
                        ? "Manual"
                        : mpSettings.source === "env"
                          ? "Variable de entorno"
                          : "Pendiente"}
                  </span>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {canManageMercadoPagoOAuth ? (
                    <Link
                      href="/api/admin/settings/mercadopago/oauth/start"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#70471F]"
                    >
                      <CreditCard className="h-4 w-4" aria-hidden="true" />
                      {mpSettings.source === "oauth" ? "Reconectar MercadoPago" : "Conectar con MercadoPago"}
                    </Link>
                  ) : null}
                  {canManageMercadoPagoOAuth && (mpSettings.source === "oauth" || mpSettings.source === "manual") ? (
                    <SecondaryButton onClick={disconnectMercadoPago} loading={mpLoading} label="Desconectar" />
                  ) : null}
                </div>

                {canManageMercadoPagoManualToken ? (
                  <div className="mt-6 rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4">
                    <FieldLabel
                      label="Access Token manual"
                      help={mpSettings.source === "manual" ? "Hay un token guardado. Ingresá uno nuevo solo si querés reemplazarlo." : "Usalo solo como alternativa si OAuth no está disponible."}
                    />
                    <input
                      type="password"
                      value={mpAccessToken}
                      onChange={(e) => setMpAccessToken(e.target.value)}
                      placeholder={mpSettings.accessTokenConfigured ? "Token ya configurado" : "APP_USR-..."}
                      autoComplete="off"
                      className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                    />

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <PrimaryButton onClick={saveMercadoPagoSettings} loading={mpLoading} label={mpSettings.source === "manual" ? "Actualizar token" : "Guardar token"} />
                    </div>
                  </div>
                ) : null}

                {mpMsg ? <Notice>{mpMsg}</Notice> : null}
              </div>

              <div className="mt-5 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#5F3B18]">Pagos manuales</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#8F6A49]">
                      Activá opciones para que el cliente cree el pedido sin redirección online.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#E5D7C8] bg-white/70 px-3 py-1 text-xs font-semibold text-[#8B5A2B]">
                    {manualMethods.filter((method) => method.enabled).length} activos
                  </span>
                </div>

                <div className="mt-5 grid gap-4">
                  {manualMethods.map((method) => (
                    <div key={method.key} className="rounded-2xl border border-[#E5D7C8] bg-white/70 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-[#5F3B18]">{method.label}</div>
                          <div className="mt-1 text-xs text-[#8F6A49]">
                            {method.key === "agreement"
                              ? "El cliente coordina el pago con la tienda."
                              : method.key === "cash"
                                ? "Pago en efectivo."
                                : "Pago por transferencia bancaria."}
                          </div>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={method.enabled}
                          onClick={() => patchManualMethod(method.key, { enabled: !method.enabled })}
                          className={[
                            "rounded-2xl px-4 py-2 text-sm font-semibold transition duration-150",
                            method.enabled
                              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                              : "bg-[#F2ECE5] text-[#8B5A2B] ring-1 ring-[#E5D7C8]",
                          ].join(" ")}
                        >
                          {method.enabled ? "Activo" : "Inactivo"}
                        </button>
                      </div>
                      <label className="mt-4 block">
                        <FieldLabel label="Instrucciones para el cliente" />
                        <textarea
                          value={method.instructions}
                          onChange={(e) => patchManualMethod(method.key, { instructions: e.target.value })}
                          rows={method.key === "transfer" ? 7 : 2}
                          maxLength={500}
                          className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm leading-6 text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                        />
                      </label>
                      {method.key === "transfer" ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          {([
                            ["accountNumber", "Número de cuenta"],
                            ["cbu", "CBU"],
                            ["alias", "Alias"],
                            ["holder", "Titular"],
                            ["taxId", "CUIL / CUIT"],
                            ["accountType", "Tipo de cuenta"],
                            ["bank", "Banco"],
                          ] as const).map(([key, label]) => (
                            <label key={key} className={key === "bank" ? "sm:col-span-2" : ""}>
                              <FieldLabel label={label} />
                              <input
                                value={method.bankDetails?.[key] || ""}
                                onChange={(e) => patchTransferBankDetail(key, e.target.value)}
                                maxLength={160}
                                className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                              />
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PrimaryButton onClick={saveManualPaymentMethods} loading={manualPaymentsLoading} label="Guardar pagos manuales" />
                </div>
                {manualPaymentsMsg ? <Notice>{manualPaymentsMsg}</Notice> : null}
              </div>

              <div className="mt-5 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#5F3B18]">Modal de financiación</h3>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[#8F6A49]">
                      Elegí qué opciones aparecen cuando el cliente abre “Métodos de pago y financiación” en un producto.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#E5D7C8] bg-white/70 px-3 py-1 text-xs font-semibold text-[#8B5A2B]">
                    {[
                      financingDisplay.goCuotas,
                      financingDisplay.mercadopago,
                      ...manualMethods.map((method) => financingDisplay.manualMethods[method.key]),
                    ].filter(Boolean).length} visibles
                  </span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <FinancingDisplayToggle
                    label="GO Cuotas con débito"
                    description="Muestra la opción de hasta 3 cuotas sin interés."
                    checked={financingDisplay.goCuotas}
                    onChange={(visible) => setFinancingDisplay((prev) => ({ ...prev, goCuotas: visible }))}
                  />
                  <FinancingDisplayToggle
                    label="MercadoPago"
                    description={mpSettings.accessTokenConfigured ? "Muestra MercadoPago en financiación." : "Podés ocultarlo mientras no haya credencial activa."}
                    checked={financingDisplay.mercadopago}
                    onChange={(visible) => setFinancingDisplay((prev) => ({ ...prev, mercadopago: visible }))}
                  />
                  {manualMethods.map((method) => (
                    <FinancingDisplayToggle
                      key={method.key}
                      label={method.key === "agreement" ? "Acordar" : method.label}
                      description={method.enabled ? "Visible si también está activo para checkout." : "Está oculto en tienda porque el checkout lo tiene inactivo."}
                      checked={financingDisplay.manualMethods[method.key]}
                      onChange={(visible) => patchFinancingManualMethod(method.key, visible)}
                    />
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PrimaryButton onClick={saveManualPaymentMethods} loading={manualPaymentsLoading} label="Guardar visibilidad" />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Checkout" description="Estado operativo del cobro online." icon={CreditCard}>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                  <div className="text-sm font-semibold text-[#5F3B18]">MercadoPago</div>
                  <div className="mt-1 text-sm text-[#8F6A49]">
                    {mpSettings.accessTokenConfigured ? "Activo para checkout" : "Sin credencial activa"}
                  </div>
                </div>
                {manualMethods.map((method) => (
                  <div key={method.key} className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                    <div className="text-sm font-semibold text-[#5F3B18]">{method.label}</div>
                    <div className="mt-1 text-sm text-[#8F6A49]">{method.enabled ? "Activo para checkout" : "Inactivo"}</div>
                  </div>
                ))}
                <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                  <div className="text-sm font-semibold text-[#5F3B18]">Credencial activa</div>
                  <div className="mt-1 text-sm text-[#8F6A49]">
                    {mpSettings.source === "oauth"
                      ? "Cuenta conectada por OAuth"
                      : mpSettings.source === "manual"
                        ? "Token manual guardado desde configuración"
                      : mpSettings.source === "env"
                        ? "MP_ACCESS_TOKEN del servidor"
                        : "Sin token disponible"}
                  </div>
                </div>
                {mpSettings.connectedUserId ? (
                  <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                    <div className="text-sm font-semibold text-[#5F3B18]">Cuenta conectada</div>
                    <div className="mt-1 text-sm text-[#8F6A49]">{mpSettings.connectedUserId}</div>
                  </div>
                ) : null}
                {mpSettings.expiresAt ? (
                  <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                    <div className="text-sm font-semibold text-[#5F3B18]">Renovación</div>
                    <div className="mt-1 text-sm text-[#8F6A49]">Automática antes del vencimiento.</div>
                  </div>
                ) : null}
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "domain" ? (
          <DomainSettingsSection
            settings={domainSettings}
            customDomain={customDomain}
            loading={domainLoading}
            verifyLoading={domainVerifyLoading}
            message={domainMsg}
            onChange={setCustomDomain}
            onSave={saveCustomDomainSettings}
            onVerify={verifyCustomDomainSettings}
          />
        ) : null}

        {activeTab === "social" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard title="Redes sociales" description="Configurá los enlaces que aparecen en el footer de la tienda." icon={Share2}>
              <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="grid gap-4">
                  <SocialLinkField
                    label="Facebook"
                    value={socialLinks.facebook}
                    placeholder="https://facebook.com/tu-tienda"
                    onChange={(facebook) => setSocialLinks((prev) => ({ ...prev, facebook }))}
                  />
                  <SocialLinkField
                    label="Instagram"
                    value={socialLinks.instagram}
                    placeholder="https://instagram.com/tu-tienda"
                    onChange={(instagram) => setSocialLinks((prev) => ({ ...prev, instagram }))}
                  />
                  <SocialLinkField
                    label="TikTok"
                    value={socialLinks.tiktok}
                    placeholder="https://tiktok.com/@tu-tienda"
                    onChange={(tiktok) => setSocialLinks((prev) => ({ ...prev, tiktok }))}
                  />
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <PrimaryButton onClick={saveSocialLinksSettings} loading={socialLinksLoading} label="Guardar redes" />
                  <span className="text-xs text-[#A37A55]">Dejá vacío el campo que no quieras mostrar.</span>
                </div>
                {socialLinksMsg ? <Notice>{socialLinksMsg}</Notice> : null}
              </div>
            </SectionCard>

            <SectionCard title="Preview del footer" description="Así se verán los iconos configurados." icon={Share2}>
              <div className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4">
                <h3 className="text-sm font-semibold uppercase text-[#5F3B18]">Nuestras redes sociales</h3>
                <div className="mt-4 flex items-center gap-4 text-[#5F3B18]">
                  {socialLinks.facebook.trim() ? <FacebookPreviewIcon /> : null}
                  {socialLinks.instagram.trim() ? <InstagramPreviewIcon /> : null}
                  {socialLinks.tiktok.trim() ? <TikTokPreviewIcon /> : null}
                  {!socialLinks.facebook.trim() && !socialLinks.instagram.trim() && !socialLinks.tiktok.trim() ? (
                    <span className="text-sm text-[#8F6A49]">No se mostrarán redes en el footer.</span>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "analytics" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <SectionCard title="Google Analytics" description="Conectá la tienda con la propiedad GA4 del dueño de esta tienda." icon={BarChart3}>
              <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge active={Boolean(gaMeasurementId.trim())} />
                      <span className="text-sm font-semibold text-[#5F3B18]">
                        {gaMeasurementId.trim() ? "Analytics configurado" : "Analytics sin configurar"}
                      </span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#8F6A49]">
                      Pegá el Measurement ID de GA4. La tienda cargará el script público solo cuando este campo tenga un ID válido.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#E5D7C8] bg-white/70 px-3 py-1 text-xs font-semibold text-[#8B5A2B]">
                    GA4
                  </span>
                </div>

                <label className="mt-5 block">
                  <FieldLabel label="Measurement ID" help="Lo encontrás en Google Analytics > Admin > Data streams. Tiene formato G-XXXXXXXXXX." />
                  <input
                    value={gaMeasurementId}
                    onChange={(e) => setGaMeasurementId(e.target.value.toUpperCase())}
                    placeholder="G-XXXXXXXXXX"
                    autoComplete="off"
                    className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                  />
                </label>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PrimaryButton onClick={saveAnalyticsSettings} loading={analyticsLoading} label="Guardar Analytics" />
                  {gaMeasurementId.trim() ? (
                    <SecondaryButton onClick={() => setGaMeasurementId("")} label="Limpiar ID" />
                  ) : null}
                </div>

                {analyticsMsg ? <Notice>{analyticsMsg}</Notice> : null}
              </div>
            </SectionCard>

            <SectionCard title="Meta Pixel" description="Conectá la tienda con el pixel usado por Meta Ads." icon={BarChart3}>
              <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge active={Boolean(metaPixelId.trim())} />
                      <span className="text-sm font-semibold text-[#5F3B18]">
                        {metaPixelId.trim() ? "Meta Pixel configurado" : "Meta Pixel sin configurar"}
                      </span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#8F6A49]">
                      Pegá solo el Pixel ID numérico. La tienda enviará el evento base PageView en las páginas públicas.
                    </p>
                  </div>
                  <span className="rounded-full border border-[#E5D7C8] bg-white/70 px-3 py-1 text-xs font-semibold text-[#8B5A2B]">
                    Meta Ads
                  </span>
                </div>

                <label className="mt-5 block">
                  <FieldLabel label="Pixel ID" help="Lo encontrás en Meta Events Manager. Es un número, no el código completo del script." />
                  <input
                    value={metaPixelId}
                    onChange={(e) => setMetaPixelId(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456789012345"
                    inputMode="numeric"
                    autoComplete="off"
                    className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                  />
                </label>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PrimaryButton onClick={saveAnalyticsSettings} loading={analyticsLoading} label="Guardar Pixel" />
                  {metaPixelId.trim() ? (
                    <SecondaryButton onClick={() => setMetaPixelId("")} label="Limpiar ID" />
                  ) : null}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Uso por tienda" description="Cada tienda debe usar sus propias cuentas de medición." icon={Store}>
              <div className="grid gap-3">
                <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                  <div className="text-sm font-semibold text-[#5F3B18]">Dónde se carga</div>
                  <div className="mt-1 text-sm text-[#8F6A49]">En la tienda pública. El admin no carga Analytics ni Meta Pixel.</div>
                </div>
                <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                  <div className="text-sm font-semibold text-[#5F3B18]">Google Analytics</div>
                  <div className="mt-1 text-sm text-[#8F6A49]">{gaMeasurementId.trim() || "Sin Measurement ID"}</div>
                </div>
                <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                  <div className="text-sm font-semibold text-[#5F3B18]">Meta Pixel</div>
                  <div className="mt-1 text-sm text-[#8F6A49]">{metaPixelId.trim() || "Sin Pixel ID"}</div>
                </div>
              </div>
            </SectionCard>
          </div>
        ) : null}

        {activeTab === "categories" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard title="Categorías" description="Referencia rápida de las categorías disponibles para destacar en el inicio." icon={LayoutGrid}>
              {categories.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.map((category) => (
                    <div key={category.id} className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                      <div className="font-semibold text-[#5F3B18]">{category.label ?? category.name}</div>
                      <div className="mt-1 text-xs text-[#8F6A49]">/{category.slug}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={LayoutGrid} title="No hay categorías creadas." description="Creá categorías desde Catálogo para poder destacarlas en el inicio." />
              )}
            </SectionCard>

            <SectionCard title="Categorías destacadas" description="Esta configuración vive en la pestaña Inicio." icon={Home}>
              <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="text-3xl font-semibold text-[#5F3B18]">{tiles.length}</div>
                <p className="mt-2 text-sm text-[#8F6A49]">Categorías destacadas configuradas para la home.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("home")}
                  className="mt-5 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]"
                >
                  Configurar inicio
                </button>
              </div>
            </SectionCard>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function domainStatusInfo(status: DomainStatus) {
  const map: Record<DomainStatus, { title: string; description: string; className: string }> = {
    NOT_CONFIGURED: {
      title: "Sin configurar",
      description: "Todavía no cargaste un dominio personalizado.",
      className: "border-zinc-200 bg-zinc-50 text-zinc-800",
    },
    PENDING: {
      title: "Esperando configuración DNS",
      description: "Configurá los registros DNS y ejecutá la verificación.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    },
    VERIFIED: {
      title: "DNS configurado correctamente",
      description: "Falta activar HTTPS en el servidor para dejar el dominio conectado.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    ACTIVE: {
      title: "Dominio conectado",
      description: "HTTPS activo y dominio listo para uso público.",
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    },
    ERROR: {
      title: "Error",
      description: "La verificación encontró un problema anómalo.",
      className: "border-red-200 bg-red-50 text-red-800",
    },
  };

  return map[status];
}

function formatDateTime(value: string | null) {
  if (!value) return null;

  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return null;
  }
}

function DomainSettingsSection({
  settings,
  customDomain,
  loading,
  verifyLoading,
  message,
  onChange,
  onSave,
  onVerify,
}: {
  settings: CustomDomainSettings;
  customDomain: string;
  loading: boolean;
  verifyLoading: boolean;
  message: string | null;
  onChange: (value: string) => void;
  onSave: () => void;
  onVerify: () => void;
}) {
  const status = domainStatusInfo(settings.domainStatus);
  const verifiedAt = formatDateTime(settings.domainVerifiedAt);
  const activatedAt = formatDateTime(settings.domainActivatedAt);
  const rootRecordTarget = settings.serverIps.length > 0 ? settings.serverIps.join(" / ") : "IP_DE_LA_VPS";

  return (
    <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <SectionCard title="Dominio personalizado" description="Conectá un dominio propio a esta tienda." icon={Globe}>
        <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className={["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", status.className].join(" ")}>
                {settings.domainStatus === "ACTIVE" || settings.domainStatus === "VERIFIED" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {status.title}
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#8F6A49]">{status.description}</p>
              {settings.errorMessage ? (
                <p className="mt-2 max-w-xl text-sm leading-6 text-red-700">{settings.errorMessage}</p>
              ) : null}
            </div>
            {settings.customDomain ? (
              <span className="rounded-full border border-[#E5D7C8] bg-white/70 px-3 py-1 text-xs font-semibold text-[#8B5A2B]">
                {settings.customDomain}
              </span>
            ) : null}
          </div>

          <label className="mt-5 block">
            <FieldLabel
              label="Dominio"
              help="Ingresá solo el dominio. Si pegás https://www.tudominio.com.ar/ se guardará como tudominio.com.ar."
            />
            <input
              value={customDomain}
              onChange={(e) => onChange(e.target.value)}
              placeholder="luzdemarfil.com.ar"
              autoComplete="off"
              className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
            />
          </label>

          {settings.domainStatus === "ACTIVE" && customDomain.trim() !== settings.customDomain ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 xl:py-2.5 text-sm leading-6 text-amber-900">
              Estás por reemplazar un dominio activo. El nuevo dominio quedará pendiente hasta verificar DNS y activar HTTPS manualmente.
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PrimaryButton onClick={onSave} loading={loading} label={settings.customDomain ? "Guardar cambio" : "Guardar dominio"} />
            <button
              type="button"
              onClick={onVerify}
              disabled={verifyLoading || !settings.customDomain}
              className="inline-flex items-center gap-2 rounded-2xl border border-[#E5D7C8] px-4 py-2 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              {verifyLoading ? "Verificando..." : "Verificar DNS"}
            </button>
          </div>

          {message ? <Notice>{message}</Notice> : null}
        </div>
      </SectionCard>

      <SectionCard title="Instrucciones DNS" description="Configurá estos registros en el proveedor donde administrás tu dominio." icon={LinkIcon}>
        <div className="grid gap-4">
          <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
            <h3 className="text-sm font-semibold text-[#5F3B18]">Para www</h3>
            <p className="mt-2 text-sm leading-6 text-[#8F6A49]">Creá un registro CNAME para que www apunte al hostname central de la plataforma.</p>
            <DnsRecordTable
              rows={[
                ["Tipo", "CNAME"],
                ["Host/Nombre", "www"],
                ["Destino", settings.dnsTarget],
              ]}
            />
          </div>

          <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
            <h3 className="text-sm font-semibold text-[#5F3B18]">Para el dominio raíz</h3>
            <p className="mt-2 text-sm leading-6 text-[#8F6A49]">
              Si tu proveedor soporta ALIAS o ANAME, usalo contra el hostname central. Si no, configurá un registro A hacia la IP pública de la VPS.
            </p>
            <DnsRecordTable
              rows={[
                ["Tipo", "ALIAS / ANAME"],
                ["Host/Nombre", "@"],
                ["Destino", settings.dnsTarget],
              ]}
            />
            <div className="mt-3">
              <DnsRecordTable
                rows={[
                  ["Tipo", "A"],
                  ["Host/Nombre", "@"],
                  ["Destino", rootRecordTarget],
                ]}
              />
            </div>
            {!settings.supportsARecord ? (
              <p className="mt-3 text-xs leading-5 text-[#A37A55]">
                Falta configurar CUSTOM_DOMAIN_SERVER_IP para mostrar y verificar automáticamente el registro A.
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4">
            <h3 className="text-sm font-semibold text-[#5F3B18]">Estado técnico</h3>
            <div className="mt-3 grid gap-3 text-sm text-[#8F6A49]">
              <div>Verificado: {verifiedAt || "Todavía no"}</div>
              <div>Activado: {activatedAt || "Todavía no"}</div>
              <div>HTTPS: {settings.domainStatus === "ACTIVE" ? "Activo" : "Pendiente de configuración manual en VPS"}</div>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function DnsRecordTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#E5D7C8] bg-white/70">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[120px_1fr] border-b border-[#E5D7C8] last:border-b-0">
          <div className="bg-[#F2ECE5] px-3 py-2 text-xs font-semibold uppercase text-[#8B5A2B]">{label}</div>
          <div className="break-all px-3 py-2 text-sm font-medium text-[#5F3B18]">{value}</div>
        </div>
      ))}
    </div>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl bg-[#F2ECE5] p-3 text-[#8B5A2B]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#5F3B18]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[#8F6A49]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#70471F]">{label}</span>
      {help ? <span className="mt-1 block text-sm text-[#8F6A49]">{help}</span> : null}
    </label>
  );
}

function PrimaryButton({ onClick, loading, label }: { onClick: () => void; loading?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#70471F] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Save className="h-4 w-4" aria-hidden="true" />
      {loading ? "Guardando..." : label}
    </button>
  );
}

function SecondaryButton({ onClick, loading, label }: { onClick: () => void; loading?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl border border-[#E5D7C8] px-4 py-2 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Guardando..." : label}
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#70471F]">
      {children}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
      ].join(" ")}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {active ? "Activa" : "Pausada"}
    </span>
  );
}

function UploadCard({
  title,
  description,
  imageUrl,
  emptyTitle,
  emptyDescription,
  loading,
  buttonLabel,
  accept,
  onUpload,
  large = false,
}: {
  title: string;
  description: string;
  imageUrl: string;
  emptyTitle: string;
  emptyDescription: string;
  loading: boolean;
  buttonLabel: string;
  accept: string;
  onUpload: (file: File) => void;
  large?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-[#5F3B18]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#8F6A49]">{description}</p>
        </div>
        <ImageIcon className="h-5 w-5 shrink-0 text-[#B18B68]" aria-hidden="true" />
      </div>

      <div
        className={[
          "mt-5 flex items-center justify-center overflow-hidden rounded-3xl border border-dashed border-[#D8C5B2] bg-white/70 p-4",
          large ? "h-44" : "h-32",
        ].join(" ")}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-7 w-7 text-[#B18B68]" aria-hidden="true" />
            <div className="mt-3 text-sm font-semibold text-[#5F3B18]">{emptyTitle}</div>
            <div className="mt-1 text-sm text-[#8F6A49]">{emptyDescription}</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]">
          {loading ? "Subiendo..." : buttonLabel}
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {imageUrl ? <span className="text-xs text-[#A37A55]">Imagen configurada</span> : null}
      </div>
    </div>
  );
}

function StorePreview({
  logo,
  text,
  title,
  shutdownEnabled,
}: {
  logo: string;
  text: string;
  title: string;
  shutdownEnabled: boolean;
}) {
  return (
    <aside className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)] xl:sticky xl:top-6 xl:self-start">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#5F3B18]">Preview en vivo</h2>
          <p className="mt-1 text-sm text-[#8F6A49]">Vista simplificada de la tienda.</p>
        </div>
        <Eye className="h-5 w-5 text-[#B18B68]" aria-hidden="true" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5]">
        <AnnouncementPreview text={text} compact />
        <div className="flex items-center justify-between gap-4 border-b border-[#E5D7C8] bg-white px-5 py-4 xl:py-2.5">
          <div className="flex h-14 w-28 items-center justify-center rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs font-semibold text-[#B18B68]">Logo</span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="h-8 w-16 rounded-full bg-[#F2ECE5]" />
            <span className="h-8 w-20 rounded-full bg-[#8B5A2B]" />
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-3xl bg-white p-5 xl:p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#B18B68]">Header</div>
            <div className="mt-2 text-xl font-semibold text-[#5F3B18]">{title || "Fika Store"}</div>
            <div className="mt-3 h-2 w-2/3 rounded-full bg-[#E5D7C8]" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-[#E5D7C8]" />
            <div className="mt-5 flex gap-3">
              <div className="h-10 flex-1 rounded-2xl bg-[#8B5A2B]" />
              <div className="h-10 flex-1 rounded-2xl border border-[#E5D7C8]" />
            </div>
          </div>
          {shutdownEnabled ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 xl:py-2.5 text-sm text-amber-900">
              La tienda está apagada temporalmente.
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function AnnouncementPreview({ text, compact = false }: { text: string; compact?: boolean }) {
  const benefits = getAnnouncementBenefits(text);
  const mobileBenefits = [...benefits].sort((a, b) => {
    const rank = (title: string) => {
      if (title.includes("15%")) return 0;
      if (title.includes("CUOTAS")) return 1;
      return 2;
    };
    return rank(a.title) - rank(b.title);
  });
  const mobile = mobileBenefits[0] ?? benefits[0];

  return (
    <div className="bg-[#070707] text-white">
      {mobile ? (
        <div className={["flex items-center justify-center gap-2 px-3 sm:hidden", compact ? "py-2" : "py-3"].join(" ")}>
          <mobile.Icon className="h-4 w-4 shrink-0 text-[#B9824A]" aria-hidden="true" />
          <div className="text-left leading-tight">
            <div className="text-[11px] font-bold uppercase tracking-wide">{mobile.title}</div>
            {mobile.subtitle ? <div className="mt-0.5 text-[10px] font-medium text-white">{mobile.subtitle}</div> : null}
          </div>
        </div>
      ) : null}

      <div className={["hidden grid-cols-3 divide-x divide-white/20 px-3 sm:grid", compact ? "py-2" : "py-3"].join(" ")}>
        {benefits.map(({ title, subtitle, Icon }) => (
          <div key={title} className="flex min-w-0 items-center justify-center gap-2 px-2">
            <Icon className="h-4 w-4 shrink-0 text-[#B9824A]" aria-hidden="true" />
            <div className="min-w-0 text-left leading-tight">
              <div className="truncate text-[11px] font-bold uppercase tracking-wide">{title}</div>
              {subtitle ? <div className="mt-0.5 truncate text-[10px] font-medium text-white">{subtitle}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeBannerSection({
  settings,
  loading,
  message,
  setEnabled,
  addSlide,
  patchSlide,
  removeSlide,
  uploadSlideImage,
  save,
}: {
  settings: HomeBannerSettings;
  loading: boolean;
  message: string | null;
  setEnabled: (enabled: boolean) => void;
  addSlide: () => void;
  patchSlide: (id: string, patch: Partial<HomeBannerSlide>) => void;
  removeSlide: (id: string) => void;
  uploadSlideImage: (id: string, file: File) => void;
  save: () => void;
}) {
  return (
    <SectionCard title="Banner de inicio" description="Configurá imágenes rotativas con texto superpuesto para la home." icon={ImageIcon}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
        <div>
          <div className="flex items-center gap-2">
            <StatusBadge active={settings.enabled} />
            <span className="text-sm font-semibold text-[#5F3B18]">{settings.enabled ? "Banner visible" : "Banner oculto"}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-[#8F6A49]">El banner aparece arriba de las categorías destacadas cuando está activo.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          onClick={() => setEnabled(!settings.enabled)}
          className={[
            "rounded-2xl px-5 py-3 xl:py-2.5 text-sm font-semibold transition duration-150",
            settings.enabled
              ? "bg-[#8B5A2B] text-white hover:bg-[#70471F]"
              : "border border-[#E5D7C8] text-[#8B5A2B] hover:bg-[#F2ECE5]",
          ].join(" ")}
        >
          {settings.enabled ? "Ocultar banner" : "Mostrar banner"}
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#5F3B18]">Imágenes del banner</h3>
          <p className="mt-1 text-sm text-[#8F6A49]">Cada slide puede tener título, subtítulo y enlace opcional.</p>
        </div>
        <button
          type="button"
          onClick={addSlide}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#E5D7C8] px-4 py-2 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar
        </button>
      </div>

      {settings.slides.length === 0 ? (
        <EmptyState icon={ImageIcon} title="No hay imágenes en el banner." description="Agregá una imagen para crear el carrusel de inicio." />
      ) : (
        <div className="grid gap-5 xl:gap-4">
          {settings.slides.map((slide) => (
            <div key={slide.id} className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
              <div className="grid gap-5 xl:gap-4 lg:grid-cols-[320px_1fr]">
                <div className="overflow-hidden rounded-3xl border border-[#E5D7C8] bg-white">
                  <div className="relative aspect-[16/7] min-h-[150px]">
                    {slide.imageUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={slide.imageUrl} alt={slide.title || "Banner"} className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 px-4 text-center text-white">
                          <div className="text-lg font-bold uppercase tracking-[0.16em]">{slide.title || "Título"}</div>
                          {slide.subtitle ? <div className="mt-2 text-xs font-medium uppercase tracking-[0.18em]">{slide.subtitle}</div> : null}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                        <ImageIcon className="h-7 w-7 text-[#B18B68]" aria-hidden="true" />
                        <div className="mt-3 text-sm font-semibold text-[#5F3B18]">Todavía no cargaste imagen.</div>
                        <div className="mt-1 text-sm text-[#8F6A49]">Subí una imagen para este slide.</div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid content-start gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <FieldLabel label="Título" help="Texto principal sobre la imagen." />
                      <input
                        value={slide.title}
                        maxLength={90}
                        onChange={(e) => patchSlide(slide.id, { title: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                      />
                    </label>

                    <label className="block">
                      <FieldLabel label="Subtítulo" help="Texto secundario opcional." />
                      <input
                        value={slide.subtitle}
                        maxLength={120}
                        onChange={(e) => patchSlide(slide.id, { subtitle: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <FieldLabel label="Enlace opcional" help="Ejemplo: /products?category=pijamas" />
                    <input
                      value={slide.href}
                      maxLength={240}
                      onChange={(e) => patchSlide(slide.id, { href: e.target.value })}
                      className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                    />
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="cursor-pointer rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]">
                      {slide.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadSlideImage(slide.id, file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removeSlide(slide.id)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition duration-150 hover:bg-red-100"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={save} loading={loading} label="Guardar banner de inicio" />
        {message ? <span className="text-sm text-[#70471F]">{message}</span> : null}
      </div>
    </SectionCard>
  );
}

function HomeTilesSection({
  tiles,
  categories,
  tilesLoading,
  tileMsg,
  addTile,
  patchTile,
  uploadTileImage,
  saveTiles,
  removeTile,
}: {
  tiles: HomeCategoryTile[];
  categories: CategoryOption[];
  tilesLoading: boolean;
  tileMsg: string | null;
  addTile: () => void;
  patchTile: (id: string, patch: Partial<HomeCategoryTile>) => void;
  uploadTileImage: (id: string, file: File) => void;
  saveTiles: () => void;
  removeTile: (id: string) => void;
}) {
  return (
    <SectionCard title="Inicio" description="Configurá las categorías destacadas que aparecen en la home." icon={Home}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#5F3B18]">Categorías destacadas</h3>
          <p className="mt-1 text-sm text-[#8F6A49]">Cada tarjeta combina imagen, categoría y título visible.</p>
        </div>
        <button
          type="button"
          onClick={addTile}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#E5D7C8] px-4 py-2 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar
        </button>
      </div>

      {tiles.length === 0 ? (
        <EmptyState icon={Home} title="No hay categorías destacadas." description="Agregá una categoría para mostrarla como tarjeta principal en la home." />
      ) : (
        <div className="grid gap-5 xl:gap-4">
          {tiles.map((tile) => {
            const selectedCategory = categories.find((category) => category.id === tile.categoryId);
            return (
              <div key={tile.id} className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                <div className="grid gap-5 xl:gap-4 lg:grid-cols-[260px_1fr]">
                  <div className="overflow-hidden rounded-3xl border border-[#E5D7C8] bg-white">
                    <div className="relative aspect-[4/3]">
                      {tile.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={tile.imageUrl} alt={tile.title} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 px-4 text-center text-xl font-bold uppercase text-white">
                            {tile.title || selectedCategory?.name}
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                          <ImageIcon className="h-7 w-7 text-[#B18B68]" aria-hidden="true" />
                          <div className="mt-3 text-sm font-semibold text-[#5F3B18]">Todavía no cargaste imagen.</div>
                          <div className="mt-1 text-sm text-[#8F6A49]">Subí una imagen para esta categoría.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid content-start gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <FieldLabel label="Categoría" help="Destino de la tarjeta destacada." />
                        <select
                          value={tile.categoryId}
                          onChange={(e) => {
                            const category = categories.find((item) => item.id === e.target.value);
                            if (!category) return;
                            patchTile(tile.id, {
                              categoryId: category.id,
                              categorySlug: category.slug,
                              title: tile.title || category.name,
                            });
                          }}
                          className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label ?? category.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <FieldLabel label="Título visible" help="Texto que se muestra sobre la imagen." />
                        <input
                          value={tile.title}
                          onChange={(e) => patchTile(tile.id, { title: e.target.value })}
                          className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="cursor-pointer rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]">
                        {tile.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadTileImage(tile.id, file);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => removeTile(tile.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition duration-150 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={saveTiles} loading={tilesLoading} label="Guardar categorías destacadas" />
        {tileMsg ? <span className="text-sm text-[#70471F]">{tileMsg}</span> : null}
      </div>
    </SectionCard>
  );
}

function PagesSection({
  sections,
  editingSection,
  editingSectionId,
  draggingSectionId,
  dragOverSectionId,
  sectionsEnabled,
  sectionsLoading,
  sectionsMsg,
  informationContentRef,
  setDraggingSectionId,
  setDragOverSectionId,
  setEditingSectionId,
  setSections,
  addSection,
  patchSection,
  setAllSectionsActive,
  moveSection,
  formatInformationContent,
  addInformationLink,
  uploadInformationImage,
  syncInformationContentFromEditor,
  saveSections,
}: {
  sections: InformationSection[];
  editingSection: InformationSection | null;
  editingSectionId: string | null;
  draggingSectionId: string | null;
  dragOverSectionId: string | null;
  sectionsEnabled: boolean;
  sectionsLoading: boolean;
  sectionsMsg: string | null;
  informationContentRef: React.RefObject<HTMLDivElement | null>;
  setDraggingSectionId: (id: string | null) => void;
  setDragOverSectionId: (id: string | null | ((current: string | null) => string | null)) => void;
  setEditingSectionId: (id: string | null) => void;
  setSections: React.Dispatch<React.SetStateAction<InformationSection[]>>;
  addSection: () => void;
  patchSection: (id: string, patch: Partial<InformationSection>) => void;
  setAllSectionsActive: (isActive: boolean) => void;
  moveSection: (fromId: string, toId: string) => void;
  formatInformationContent: (command: string, value?: string) => void;
  addInformationLink: () => void;
  uploadInformationImage: (file: File) => void;
  syncInformationContentFromEditor: () => void;
  saveSections: () => void;
}) {
  return (
    <SectionCard title="Páginas" description="Gestioná páginas de información visibles en el menú principal." icon={FileText}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge active={sectionsEnabled} />
          <span className="text-sm text-[#8F6A49]">{sections.length} página{sections.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => setAllSectionsActive(!sectionsEnabled)} label={sectionsEnabled ? "Desactivar páginas" : "Activar páginas"} />
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva página
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <EmptyState icon={FileText} title="Todavía no existen páginas." description="Agregá páginas para políticas, preguntas frecuentes o tabla de talles." />
      ) : (
        <div className="grid gap-3">
          {sections.map((section) => (
            <div
              key={section.id}
              draggable
              onDragStart={(event) => {
                setDraggingSectionId(section.id);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", section.id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverSectionId(section.id);
              }}
              onDragLeave={() => {
                setDragOverSectionId((current) => (current === section.id ? null : current));
              }}
              onDrop={(event) => {
                event.preventDefault();
                const fromId = event.dataTransfer.getData("text/plain") || draggingSectionId;
                if (fromId) moveSection(fromId, section.id);
                setDraggingSectionId(null);
                setDragOverSectionId(null);
              }}
              onDragEnd={() => {
                setDraggingSectionId(null);
                setDragOverSectionId(null);
              }}
              className={[
                "grid cursor-move grid-cols-[32px_1fr_auto] items-center gap-3 rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-4 xl:py-2.5 transition duration-150",
                !section.isActive ? "opacity-60" : "",
                draggingSectionId === section.id ? "opacity-40" : "",
                dragOverSectionId === section.id && draggingSectionId !== section.id ? "ring-2 ring-[#8B5A2B]/30" : "",
              ].join(" ")}
            >
              <GripVertical className="h-5 w-5 text-[#B18B68]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-[#5F3B18]">{section.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8F6A49]">
                  <span>/{section.slug}</span>
                  <span className={section.isActive ? "text-emerald-700" : "text-[#A37A55]"}>
                    {section.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/informacion/${section.slug}`}
                  target="_blank"
                  title="Ver página"
                  className="rounded-xl border border-[#E5D7C8] p-2 text-[#8B5A2B] hover:bg-[#F2ECE5]"
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingSectionId(editingSectionId === section.id ? null : section.id)}
                  title="Editar página"
                  className="rounded-xl border border-[#E5D7C8] p-2 text-[#8B5A2B] hover:bg-[#F2ECE5]"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSections((prev) => prev.filter((item) => item.id !== section.id));
                    if (editingSectionId === section.id) setEditingSectionId(null);
                  }}
                  title="Eliminar página"
                  className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSection ? (
        <div className="mt-6 xl:mt-4 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#5F3B18]">Editar página</h3>
              <p className="mt-1 text-sm text-[#8F6A49]">Modificá título, URL y contenido.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#70471F]">
              <input
                type="checkbox"
                checked={editingSection.isActive}
                onChange={(e) => patchSection(editingSection.id, { isActive: e.target.checked })}
                className="h-4 w-4 accent-[#8B5A2B]"
              />
              Visible
            </label>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel label="Nombre" help="Título visible para el cliente." />
              <input
                value={editingSection.title}
                onChange={(e) => {
                  const title = e.target.value;
                  patchSection(editingSection.id, {
                    title,
                    slug: editingSection.slug ? editingSection.slug : slugify(title),
                  });
                }}
                maxLength={100}
                className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
              />
            </label>

            <label className="block">
              <FieldLabel label="URL" help="Ruta pública de la página." />
              <div className="mt-2 flex rounded-2xl border border-[#E5D7C8] bg-white/70 text-sm focus-within:border-[#8B5A2B]">
                <span className="shrink-0 px-4 py-3 xl:py-2.5 text-[#A37A55]">/informacion/</span>
                <input
                  value={editingSection.slug}
                  onChange={(e) => patchSection(editingSection.id, { slug: slugify(e.target.value) })}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 xl:py-2.5 text-[#5F3B18] outline-none"
                />
              </div>
            </label>
          </div>

          <div className="mt-5">
            <FieldLabel label="Contenido" help="Texto enriquecido que verá el cliente." />
            <div className="mt-2 overflow-hidden rounded-2xl border border-[#E5D7C8] bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E5D7C8] bg-[#FAF8F5] px-3 py-2">
                <ToolbarButton onClick={() => formatInformationContent("bold")} label="B" strong />
                <ToolbarButton onClick={() => formatInformationContent("italic")} label="I" italic />
                <ToolbarButton onClick={() => formatInformationContent("underline")} label="U" underline />
                <ToolbarButton onClick={() => formatInformationContent("formatBlock", "h2")} label="Título" />
                <ToolbarButton onClick={() => formatInformationContent("insertUnorderedList")} label="Lista" />
                <button
                  type="button"
                  onClick={addInformationLink}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E5D7C8] px-3 text-sm font-semibold text-[#70471F] hover:bg-[#F2ECE5]"
                >
                  <LinkIcon className="h-4 w-4" aria-hidden="true" />
                  Link
                </button>
                <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl border border-[#E5D7C8] px-3 text-sm font-semibold text-[#70471F] hover:bg-[#F2ECE5]">
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
                  Imagen
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) uploadInformationImage(file);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
              <div
                ref={informationContentRef}
                contentEditable
                suppressContentEditableWarning
                onInput={syncInformationContentFromEditor}
                className="min-h-64 w-full px-4 py-3 xl:py-2.5 text-sm leading-6 text-[#5F3B18] outline-none [&_a]:text-[#8B5A2B] [&_a]:underline [&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={saveSections} loading={sectionsLoading} label="Guardar páginas" />
        {sectionsMsg ? <span className="text-sm text-[#70471F]">{sectionsMsg}</span> : null}
      </div>
    </SectionCard>
  );
}

function ToolbarButton({
  onClick,
  label,
  strong,
  italic,
  underline,
}: {
  onClick: () => void;
  label: string;
  strong?: boolean;
  italic?: boolean;
  underline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 rounded-xl border border-[#E5D7C8] px-3 text-sm text-[#70471F] hover:bg-[#F2ECE5]",
        strong ? "font-bold" : "font-semibold",
        italic ? "italic" : "",
        underline ? "underline" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function FinancingDisplayToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-2xl border border-[#E5D7C8] bg-white/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[#5F3B18]">{label}</div>
          <div className="mt-1 text-xs leading-5 text-[#8F6A49]">{description}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={[
            "shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold transition duration-150",
            checked
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
              : "bg-[#F2ECE5] text-[#8B5A2B] ring-1 ring-[#E5D7C8]",
          ].join(" ")}
        >
          {checked ? "Visible" : "Oculto"}
        </button>
      </div>
    </div>
  );
}

function SocialLinkField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <FieldLabel label={label} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
      />
    </label>
  );
}

function FacebookPreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path fill="currentColor" d="M14 8h2V5h-2.4C10.9 5 10 6.8 10 8.8V11H8v3h2v7h3v-7h2.5l.5-3h-3V9c0-.7.2-1 1-1Z" />
    </svg>
  );
}

function InstagramPreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path fill="currentColor" d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.3-2.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  );
}

function TikTokPreviewIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path fill="currentColor" d="M15 3c.4 2.4 1.8 3.9 4 4.2V10a7.1 7.1 0 0 1-4-1.3V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .7 0 1 .1v3.1a2.5 2.5 0 1 0 1.5 2.3V3h3Z" />
    </svg>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[#E5D7C8] bg-[#FAF8F5] px-5 py-10 xl:py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#8B5A2B] shadow-sm">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="mt-4 font-semibold text-[#5F3B18]">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#8F6A49]">{description}</p>
    </div>
  );
}
