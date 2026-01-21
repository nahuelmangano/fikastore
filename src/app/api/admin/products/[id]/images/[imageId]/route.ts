import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import { unlink } from "fs/promises";

export const runtime = "nodejs";

export async function DELETE(_: Request, { params }: { params: { id: string; imageId: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const img = await prisma.productImage.findFirst({
    where: { id: params.imageId, productId: params.id },
  });
  if (!img) return NextResponse.json({ ok: false, error: "Imagen no existe" }, { status: 404 });

  await prisma.productImage.delete({ where: { id: img.id } });

  // borrado del archivo si está en /public/uploads
  if (img.url.startsWith("/uploads/")) {
    const filepath = path.join(process.cwd(), "public", img.url);
    await unlink(filepath).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
