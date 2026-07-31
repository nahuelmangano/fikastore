import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";
import AdminCategoriesPage from "./ui";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      parentId: true,
      sortOrder: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { products: true } },
    },
  });

  return <AdminCategoriesPage initialCategories={flattenCategories(categories)} />;
}
