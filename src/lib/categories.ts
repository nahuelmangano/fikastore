import { prisma } from "@/lib/prisma";

export type CategoryTreeItem = {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
};

export type CategoryOption = CategoryTreeItem & {
  label: string;
  depth: number;
};

export function flattenCategories<T extends CategoryTreeItem>(categories: T[]) {
  const byParent = new Map<string, T[]>();
  for (const category of categories) {
    const parentKey = category.parentId || "";
    byParent.set(parentKey, [...(byParent.get(parentKey) ?? []), category]);
  }

  for (const items of byParent.values()) {
    items.sort((a, b) => a.name.localeCompare(b.name));
  }

  const flattened: Array<T & CategoryOption> = [];

  function visit(parentId: string, depth: number, prefix: string) {
    for (const category of byParent.get(parentId) ?? []) {
      const label = prefix ? `${prefix} / ${category.name}` : category.name;
      flattened.push({ ...category, label, depth });
      visit(category.id, depth + 1, label);
    }
  }

  visit("", 0, "");
  return flattened;
}

export async function getCategoryAndDescendantIds(slug: string) {
  const root = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!root) return [];

  const ids = new Set([root.id]);
  let frontier = [root.id];

  while (frontier.length > 0) {
    const children = await prisma.category.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((category) => category.id).filter((id) => !ids.has(id));
    for (const id of frontier) ids.add(id);
  }

  return Array.from(ids);
}
