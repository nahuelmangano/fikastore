import { prisma } from "@/lib/prisma";
import {
  getAnnouncementText,
  getFaviconUrl,
  getHomeCategoryTiles,
  getSiteTitle,
  getStoreLogoUrl,
} from "@/lib/storeSettings";
import { getMercadoPagoConnectionStatus } from "@/lib/mercadopago";
import AdminSettingsPage from "./ui";

function appBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    ""
  ).replace(/\/$/, "");
}

export default async function SettingsPage() {
  const baseUrl = appBaseUrl();
  const [announcementText, logoUrl, homeCategoryTiles, siteTitle, faviconUrl, mpStatus, categories] = await Promise.all([
    getAnnouncementText(),
    getStoreLogoUrl(),
    getHomeCategoryTiles(),
    getSiteTitle(),
    getFaviconUrl(),
    getMercadoPagoConnectionStatus(baseUrl || undefined),
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
      siteTitle={siteTitle}
      faviconUrl={faviconUrl}
      mpStatus={mpStatus}
      categories={categories}
    />
  );
}
