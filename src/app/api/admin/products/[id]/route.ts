import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;

  if (role !== "admin") {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));

  const stock = Number(body.stock);
  const price = Number(body.price);
  const isActive = Boolean(body.isActive);

  if (!Number.isFinite(stock) || stock < 0) {
    return NextResponse.json({ ok: false, error: "Stock invǭlido" }, { status: 400 });
  }
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ ok: false, error: "Precio invǭlido" }, { status: 400 });
  }

  const updated = await prisma.product.update({
    where: { id: params.id },
    data: {
      stock,
      price: price.toFixed(2),
      isActive,
    },
  });

  return NextResponse.json({ ok: true, product: updated });
}
