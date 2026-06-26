import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";
import {
  getAnnouncementText,
  getFaviconUrl,
  getHomeCategoryTiles,
  getSiteTitle,
  getStoreLogoUrl,
} from "@/lib/storeSettings";
import AdminSettingsPage from "./ui";

export default async function SettingsPage() {
  const [announcementText, logoUrl, homeCategoryTiles, siteTitle, faviconUrl, categories] = await Promise.all([
    getAnnouncementText(),
    getStoreLogoUrl(),
    getHomeCategoryTiles(),
    getSiteTitle(),
    getFaviconUrl(),
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
      categories={flattenCategories(categories)}
    />
  );
}
