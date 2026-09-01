import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/publicUrl";
import { getSiteTitle } from "@/lib/storeSettings";

export const runtime = "nodejs";

type FeedItem = {
  id: string;
  itemGroupId?: string;
  title: string;
  description: string;
  availability: "in stock" | "out of stock";
  condition: "new";
  price: string;
  link: string;
  imageLink: string;
  brand: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripHtml(value: string | null | undefined) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPrice(value: number) {
  return `${value.toFixed(2)} ARS`;
}

function absoluteUrl(baseUrl: string, value: string | null | undefined) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

function productLink(baseUrl: string, slug: string, variantId?: string | null) {
  const url = new URL(`/products/${slug}`, baseUrl);
  if (variantId) url.searchParams.set("variant", variantId);
  return url.toString();
}

function primaryProductImage(baseUrl: string, images: Array<{ url: string }>) {
  return absoluteUrl(baseUrl, images[0]?.url || "");
}

function primaryVariantImage(
  baseUrl: string,
  variantImages: Array<{ image: { url: string; visible: boolean } }>,
  fallbackImages: Array<{ url: string }>
) {
  const variantImage = variantImages.find((item) => item.image.visible)?.image.url || "";
  return absoluteUrl(baseUrl, variantImage || fallbackImages[0]?.url || "");
}

function buildXml(baseUrl: string, brand: string, items: FeedItem[]) {
  const feedUpdatedAt = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${escapeXml(brand)}</title>
    <link>${escapeXml(baseUrl)}</link>
    <description>${escapeXml(`Catálogo de productos de ${brand}`)}</description>
    <lastBuildDate>${escapeXml(feedUpdatedAt)}</lastBuildDate>
${items
  .map((item) => `    <item>
      <g:id>${escapeXml(item.id)}</g:id>
      <g:title>${escapeXml(item.title)}</g:title>
      <g:description>${escapeXml(item.description)}</g:description>
      <g:availability>${escapeXml(item.availability)}</g:availability>
      <g:condition>${item.condition}</g:condition>
      <g:price>${escapeXml(item.price)}</g:price>
      <g:link>${escapeXml(item.link)}</g:link>
      <g:image_link>${escapeXml(item.imageLink)}</g:image_link>
      <g:brand>${escapeXml(item.brand)}</g:brand>${item.itemGroupId ? `
      <g:item_group_id>${escapeXml(item.itemGroupId)}</g:item_group_id>` : ""}
    </item>`)
  .join("\n")}
  </channel>
</rss>`;
}

export async function GET(req: Request) {
  const baseUrl = publicBaseUrl(req);
  const brand = (await getSiteTitle()).trim() || "Fika";

  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      images: {
        where: { visible: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { url: true },
      },
      variants: {
        orderBy: [{ createdAt: "asc" }],
        include: {
          images: {
            orderBy: [{ sortOrder: "asc" }, { imageId: "asc" }],
            include: {
              image: {
                select: {
                  url: true,
                  visible: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const items: FeedItem[] = [];

  for (const product of products) {
    if (product.hasVariants && product.variants.length > 0) {
      for (const variant of product.variants) {
        const imageLink = primaryVariantImage(baseUrl, variant.images, product.images);
        if (!imageLink) continue;

        items.push({
          id: variant.id,
          itemGroupId: product.id,
          title: `${product.name} · ${variant.label}`,
          description: stripHtml(product.description) || product.name,
          availability: variant.stock > 0 ? "in stock" : "out of stock",
          condition: "new",
          price: formatPrice(
            variant.priceOverride !== null && variant.priceOverride !== undefined
              ? Number(variant.priceOverride)
              : Number(product.price)
          ),
          link: productLink(baseUrl, product.slug, variant.id),
          imageLink,
          brand,
        });
      }
      continue;
    }

    const imageLink = primaryProductImage(baseUrl, product.images);
    if (!imageLink) continue;

    items.push({
      id: product.id,
      title: product.name,
      description: stripHtml(product.description) || product.name,
      availability: product.stock > 0 ? "in stock" : "out of stock",
      condition: "new",
      price: formatPrice(Number(product.price)),
      link: productLink(baseUrl, product.slug),
      imageLink,
      brand,
    });
  }

  const xml = buildXml(baseUrl, brand, items);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
