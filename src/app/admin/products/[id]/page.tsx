import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AdminProductEditor from "./ui";

export default async function AdminProductEditPage({ params }: { params: { id: string } }) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  if (!product) return notFound();

  return <AdminProductEditor product={product as any} />;
}
