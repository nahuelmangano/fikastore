import AdminProductCreate from "./ui";
import { prisma } from "@/lib/prisma";
import { flattenCategories } from "@/lib/categories";

export default async function NewProductPage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, parentId: true, name: true, slug: true },
  });

  return <AdminProductCreate categories={flattenCategories(categories)} />;
}
