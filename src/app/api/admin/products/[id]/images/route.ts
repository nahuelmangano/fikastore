import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import path from "path";
import { mkdir, writeFile } from "fs/promises";

export const runtime = "nodejs";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function POST(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "admin") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Archivo requerido (field: file)" }, { status: 400 });
  }

  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();
  if (!id) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return NextResponse.json({ ok: false, error: "Producto no existe" }, { status: 404 });

  const bytes = Buffer.from(await file.arrayBuffer());

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${crypto.randomUUID()}-${safeName(file.name)}`;
  const filepath = path.join(uploadsDir, filename);

  await writeFile(filepath, bytes);

  const url = `/uploads/${filename}`;

  const maxSort = await prisma.productImage.aggregate({
    where: { productId: product.id },
    _max: { sortOrder: true },
  });

  const image = await prisma.productImage.create({
    data: {
      productId: product.id,
      url,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  return NextResponse.json({ ok: true, image });
}
