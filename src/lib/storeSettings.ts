import { prisma } from "@/lib/prisma";

const STOREFRONT_SETTINGS_PROVIDER = "storefront";
const ANNOUNCEMENT_TEXT_KEY = "announcement_text";
const LOGO_URL_KEY = "logo_url";
const HOME_CATEGORY_TILES_KEY = "home_category_tiles";

export const DEFAULT_ANNOUNCEMENT_TEXT =
  "3 CUOTAS SIN INTERES A PARTIR DE $50.000 | 15% OFF ABONANDO EN EFECTIVO O TRANSFERENCIA | ENVIOS GRATIS A SUCURSAL A PARTIR DE $43000";
export const DEFAULT_LOGO_URL = "/fika-logo.svg";

export type HomeCategoryTile = {
  id: string;
  categoryId: string;
  categorySlug: string;
  title: string;
  imageUrl: string;
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
