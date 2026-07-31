import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "Tenés que iniciar sesión para recibir el aviso." },
      { status: 401 }
    );
  }

  const resolvedParams = await Promise.resolve(params);
  const productId = String(resolvedParams?.id || "").trim();

  if (!productId) {
    return NextResponse.json({ ok: false, error: "Producto inválido." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, stock: true, isActive: true },
  });

  if (!product || !product.isActive) {
    return NextResponse.json({ ok: false, error: "Producto no disponible." }, { status: 404 });
  }

  if (product.stock > 0) {
    return NextResponse.json(
      { ok: false, error: "Este producto ya tiene stock disponible." },
      { status: 409 }
    );
  }

  await prisma.stockNotification.upsert({
    where: { userId_productId: { userId, productId } },
    create: { userId, productId, status: "pending" },
    update: { status: "pending", notifiedAt: null },
  });

  return NextResponse.json({
    ok: true,
    message: "Listo. Te vamos a avisar por email cuando vuelva el stock.",
  });
}
