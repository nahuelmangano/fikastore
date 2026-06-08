import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { getHomeCategoryTiles, setHomeCategoryTiles, type HomeCategoryTile } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const tiles = await getHomeCategoryTiles();
  return NextResponse.json({ ok: true, tiles });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rawTiles = Array.isArray(body.tiles) ? body.tiles.slice(0, 6) : [];

  const categories = await prisma.category.findMany({
    where: { id: { in: rawTiles.map((tile: unknown) => String((tile as { categoryId?: unknown })?.categoryId || "")) } },
    select: { id: true, slug: true, name: true },
  });
  const categoryById = new Map(categories.map((category) => [category.id, category]));

  const tiles: HomeCategoryTile[] = [];
  const errors: string[] = [];

  for (const [idx, rawTile] of rawTiles.entries()) {
    if (!rawTile || typeof rawTile !== "object") {
      errors.push(`Tarjeta ${idx + 1}: datos invalidos.`);
      continue;
    }
    const input = rawTile as Partial<HomeCategoryTile>;
    const id = String(input.id || crypto.randomUUID()).trim();
    const categoryId = String(input.categoryId || "").trim();
    const imageUrl = String(input.imageUrl || "").trim();
    const category = categoryById.get(categoryId);
    if (!category) {
      errors.push(`Tarjeta ${idx + 1}: categoria invalida.`);
      continue;
    }
    if (!imageUrl) {
      errors.push(`Tarjeta ${idx + 1}: falta subir una imagen.`);
      continue;
    }

    const title = String(input.title || category.name).trim() || category.name;
    tiles.push({
      id,
      categoryId: category.id,
      categorySlug: category.slug,
      title: title.slice(0, 80),
      imageUrl,
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });
  }

  await setHomeCategoryTiles(tiles);
  return NextResponse.json({ ok: true, tiles });
}
