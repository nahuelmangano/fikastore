import { prisma } from "@/lib/prisma";
import { sanitizeRichText, stripRichText } from "@/lib/richText";

const STOREFRONT_SETTINGS_PROVIDER = "storefront";
const INFORMATION_SECTIONS_KEY = "information_sections";

export type InformationSection = {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
};

export const DEFAULT_INFORMATION_SECTIONS: InformationSection[] = [
  {
    id: "politicas-de-devolucion",
    title: "Politicas de devolucion",
    slug: "politicas-de-devolucion",
    content: "",
    isActive: true,
  },
  {
    id: "tabla-de-medidas-pants",
    title: "Tabla de medidas pants",
    slug: "tabla-de-medidas-pants",
    content: "",
    isActive: true,
  },
  {
    id: "mayoristas",
    title: "Mayoristas",
    slug: "mayoristas",
    content: "",
    isActive: true,
  },
];

export function slugifyInformationSection(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeSection(item: Partial<InformationSection>, index: number): InformationSection | null {
  const title = String(item.title || "").trim().slice(0, 100);
  if (!title) return null;

  const id = String(item.id || crypto.randomUUID()).trim();
  const slug = slugifyInformationSection(item.slug || title) || `seccion-${index + 1}`;
  const rawContent = String(item.content || "");
  const contentSource = /<[^>]+>/.test(rawContent) ? rawContent : rawContent.replace(/\n/g, "<br>");
  const content = sanitizeRichText(contentSource);

  return {
    id,
    title,
    slug,
    content,
    isActive: item.isActive !== false,
  };
}

export function normalizeInformationSections(input: unknown) {
  const rawSections = Array.isArray(input) ? input : [];
  const usedSlugs = new Map<string, number>();

  return rawSections
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      const section = normalizeSection(item as Partial<InformationSection>, index);
      if (!section) return null;

      const count = usedSlugs.get(section.slug) ?? 0;
      usedSlugs.set(section.slug, count + 1);
      if (count > 0) section.slug = `${section.slug}-${count + 1}`;

      return section;
    })
    .filter((item): item is InformationSection => Boolean(item));
}

export async function getInformationSections() {
  const row = await prisma.shippingProviderSetting.findUnique({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: INFORMATION_SECTIONS_KEY,
      },
    },
    select: { value: true },
  });

  if (!row?.value) return DEFAULT_INFORMATION_SECTIONS;

  try {
    const sections = normalizeInformationSections(JSON.parse(row.value));
    return sections.length > 0 ? sections : DEFAULT_INFORMATION_SECTIONS;
  } catch {
    return DEFAULT_INFORMATION_SECTIONS;
  }
}

export async function getActiveInformationSections() {
  const sections = await getInformationSections();
  return sections.filter((section) => section.isActive);
}

export async function getInformationSectionBySlug(slug: string) {
  const sections = await getActiveInformationSections();
  return sections.find((section) => section.slug === slug) ?? null;
}

export async function setInformationSections(input: unknown) {
  const sections = normalizeInformationSections(input);
  const value = JSON.stringify(sections);

  await prisma.shippingProviderSetting.upsert({
    where: {
      provider_key: {
        provider: STOREFRONT_SETTINGS_PROVIDER,
        key: INFORMATION_SECTIONS_KEY,
      },
    },
    create: {
      provider: STOREFRONT_SETTINGS_PROVIDER,
      key: INFORMATION_SECTIONS_KEY,
      value,
      isSecret: false,
    },
    update: {
      value,
      isSecret: false,
    },
  });

  return sections;
}

export function getInformationSectionExcerpt(section: InformationSection) {
  return stripRichText(section.content).slice(0, 160);
}
