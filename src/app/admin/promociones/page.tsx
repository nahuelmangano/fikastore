import AdminPromotions from "./ui";
import { prisma } from "@/lib/prisma";

export default async function AdminPromotionsPage() {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      isActive: true,
      stock: true,
    },
  });

  return (
    <AdminPromotions
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        isActive: p.isActive,
        stock: p.stock,
      }))}
    />
  );
}
