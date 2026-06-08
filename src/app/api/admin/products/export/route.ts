import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const status = (searchParams.get("status") ?? "all").toLowerCase();
  const sort = (searchParams.get("sort") ?? "newest").toLowerCase();
  const category = (searchParams.get("category") ?? "all").trim();

  const where: {
    OR?: Array<{ name?: { contains: string }; slug?: { contains: string }; description?: { contains: string } }>;
    isActive?: boolean;
    stock?: number;
    categoryId?: string | null;
    category?: { slug: string };
  } = {};

  if (q) {
    where.OR = [{ name: { contains: q } }, { slug: { contains: q } }, { description: { contains: q } }];
  }

  if (status === "active") where.isActive = true;
  if (status === "inactive") where.isActive = false;
  if (status === "oos") where.stock = 0;
  if (category === "uncategorized") where.categoryId = null;
  if (category && category !== "all" && category !== "uncategorized") {
    where.category = { slug: category };
  }

  const orderBy: { [k: string]: "asc" | "desc" } =
    sort === "name"
      ? { name: "asc" }
      : sort === "price_asc"
      ? { price: "asc" }
      : sort === "price_desc"
      ? { price: "desc" }
      : sort === "stock_asc"
      ? { stock: "asc" }
      : sort === "stock_desc"
      ? { stock: "desc" }
      : { createdAt: "desc" };

  const products = await prisma.product.findMany({
    where,
    orderBy,
    include: {
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
        select: { url: true },
      },
    },
  });

  const rows = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    category: p.category?.name ?? "",
    categorySlug: p.category?.slug ?? "",
    description: p.description ?? "",
    price: Number(p.price),
    stock: p.stock,
    isActive: p.isActive,
    imageUrls: p.images.map((img) => img.url).join(", "),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "id",
      "name",
      "slug",
      "category",
      "categorySlug",
      "description",
      "price",
      "stock",
      "isActive",
      "imageUrls",
      "createdAt",
      "updatedAt",
    ],
  });

  XLSX.utils.book_append_sheet(wb, ws, "Productos");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const date = new Date().toISOString().slice(0, 10);
  const filename = `productos-${date}.xlsx`;

  return new NextResponse(buffer as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
