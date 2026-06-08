import { prisma } from "@/lib/prisma";
import { getAnnouncementText, getHomeCategoryTiles, getStoreLogoUrl } from "@/lib/storeSettings";
import AdminSettingsPage from "./ui";

export default async function SettingsPage() {
  const [announcementText, logoUrl, homeCategoryTiles, categories] = await Promise.all([
    getAnnouncementText(),
    getStoreLogoUrl(),
    getHomeCategoryTiles(),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return (
    <AdminSettingsPage
      announcementText={announcementText}
      logoUrl={logoUrl}
      homeCategoryTiles={homeCategoryTiles}
      categories={categories}
    />
  );
}
