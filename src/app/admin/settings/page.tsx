import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";
import {
  getAnnouncementText,
  getFaviconUrl,
  getHomeCategoryTiles,
  getSiteTitle,
  getStoreLogoUrl,
  getTemporaryShutdownSettings,
} from "@/lib/storeSettings";
import { getInformationSections } from "@/lib/informationSections";
import AdminSettingsPage from "./ui";

export default async function SettingsPage() {
  const [
    announcementText,
    logoUrl,
    homeCategoryTiles,
    siteTitle,
    faviconUrl,
    temporaryShutdown,
    informationSections,
    categories,
  ] = await Promise.all([
    getAnnouncementText(),
    getStoreLogoUrl(),
    getHomeCategoryTiles(),
    getSiteTitle(),
    getFaviconUrl(),
    getTemporaryShutdownSettings(),
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
      informationSections={informationSections}
      categories={flattenCategories(categories)}
    />
  );
}
