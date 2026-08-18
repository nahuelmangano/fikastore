import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";
import { auth } from "@/auth";
import {
  getAnnouncementText,
  getAnalyticsSettings,
  getFaviconUrl,
  getHomeBannerSettings,
  getHomeCategoryTiles,
  getManualPaymentSettings,
  getMercadoPagoSettings,
  getPaymentFinancingDisplaySettings,
  getSiteTitle,
  getStoreLogoUrl,
  getTemporaryShutdownSettings,
} from "@/lib/storeSettings";
import { getCustomDomainSettings } from "@/lib/customDomain";
import { getInformationSections } from "@/lib/informationSections";
import AdminSettingsPage from "./ui";

export default async function SettingsPage() {
  const session = await auth();
  const currentUserRole = (session?.user as { role?: string } | undefined)?.role || "";
  const [
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
    customDomainSettings,
    informationSections,
    categories,
  ] = await Promise.all([
    getAnnouncementText(),
    getStoreLogoUrl(),
    getHomeBannerSettings(),
    getHomeCategoryTiles(),
    getSiteTitle(),
    getFaviconUrl(),
    getTemporaryShutdownSettings(),
    getMercadoPagoSettings(),
    getManualPaymentSettings(),
    getPaymentFinancingDisplaySettings(),
    getAnalyticsSettings(),
    getCustomDomainSettings(),
    getInformationSections(),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, parentId: true, name: true, slug: true },
    }),
  ]);

  return (
    <AdminSettingsPage
      announcementText={announcementText}
      logoUrl={logoUrl}
      homeBannerSettings={homeBannerSettings}
      homeCategoryTiles={homeCategoryTiles}
      siteTitle={siteTitle}
      faviconUrl={faviconUrl}
      temporaryShutdown={temporaryShutdown}
      mercadoPagoSettings={mercadoPagoSettings}
      manualPaymentMethods={manualPaymentMethods}
      paymentFinancingDisplaySettings={paymentFinancingDisplaySettings}
      analyticsSettings={analyticsSettings}
      customDomainSettings={customDomainSettings}
      currentUserRole={currentUserRole}
      informationSections={informationSections}
      categories={flattenCategories(categories)}
    />
  );
}
