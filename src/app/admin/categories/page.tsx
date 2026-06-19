import { prisma } from "@/lib/prisma";
import AdminCategoriesPage from "./ui";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      _count: { select: { products: true } },
    },
  });

  return <AdminCategoriesPage initialCategories={categories} />;
}
