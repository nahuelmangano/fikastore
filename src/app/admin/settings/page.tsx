import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";
import { auth } from "@/auth";
import {
  getAnnouncementText,
  getFaviconUrl,
  getHomeCategoryTiles,
  getMercadoPagoSettings,
  getSiteTitle,
  getStoreLogoUrl,
  getTemporaryShutdownSettings,
} from "@/lib/storeSettings";
import { getInformationSections } from "@/lib/informationSections";
import AdminSettingsPage from "./ui";

export default async function SettingsPage() {
  const session = await auth();
  const currentUserRole = (session?.user as { role?: string } | undefined)?.role || "";
  const [
    announcementText,
    logoUrl,
    homeCategoryTiles,
    siteTitle,
    faviconUrl,
    temporaryShutdown,
    mercadoPagoSettings,
    informationSections,
    categories,
  ] = await Promise.all([
    getAnnouncementText(),
    getStoreLogoUrl(),
    getHomeCategoryTiles(),
    getSiteTitle(),
    getFaviconUrl(),
    getTemporaryShutdownSettings(),
    getMercadoPagoSettings(),
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
      homeCategoryTiles={homeCategoryTiles}
      siteTitle={siteTitle}
      faviconUrl={faviconUrl}
      temporaryShutdown={temporaryShutdown}
      mercadoPagoSettings={mercadoPagoSettings}
      currentUserRole={currentUserRole}
      informationSections={informationSections}
      categories={flattenCategories(categories)}
    />
  );
}
