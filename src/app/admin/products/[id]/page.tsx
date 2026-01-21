import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import AdminProductEditor from "./ui";

export default async function AdminProductEditPage({
  params,
}: {
  params: { id?: string } | Promise<{ id?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return notFound();

  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } } },
  });

  if (!product) return notFound();
  return <AdminProductEditor product={product as any} />;
}
