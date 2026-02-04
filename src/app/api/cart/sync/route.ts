import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type Body = {
  items: {
    productId: string;
    name: string;
    price: number;
    quantity: number;
  }[];
};

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const items = Array.isArray(body?.items) ? body!.items : [];

  const normalized = items
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      name: String(it.name || "").trim(),
      price: Number(it.price),
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter(
      (it) =>
        it.productId &&
        it.name &&
        Number.isFinite(it.price) &&
        it.price >= 0 &&
        Number.isFinite(it.quantity) &&
        it.quantity > 0
    );

  if (normalized.length === 0) {
    await prisma.cartSnapshot.deleteMany({ where: { userId } });
    return NextResponse.json({ ok: true, cleared: true });
  }

  const itemCount = normalized.reduce((acc, it) => acc + it.quantity, 0);
  const itemsJson = JSON.stringify(normalized);

  await prisma.cartSnapshot.upsert({
    where: { userId },
    create: {
      userId,
      itemsJson,
      itemCount,
    },
    update: {
      itemsJson,
      itemCount,
      reminderSentAt: null,
    },
  });

  return NextResponse.json({ ok: true });
}
