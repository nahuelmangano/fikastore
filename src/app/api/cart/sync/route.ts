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
  const cookieHeader = req.headers.get("cookie") || "";
  const anonymousCookie = cookieHeader.match(/(?:^|;\s*)fikastore_anon_cart=([^;]+)/)?.[1];
  const anonymousId = userId ? null : anonymousCookie || crypto.randomUUID();

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
    if (userId) await prisma.cartSnapshot.deleteMany({ where: { userId } });
    else if (anonymousId) await prisma.anonymousCartSnapshot.deleteMany({ where: { anonymousId } });
    const response = NextResponse.json({ ok: true, cleared: true });
    if (!userId && !anonymousCookie) response.cookies.set("fikastore_anon_cart", anonymousId!, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 90, path: "/" });
    return response;
  }

  const itemCount = normalized.reduce((acc, it) => acc + it.quantity, 0);
  const itemsJson = JSON.stringify(normalized);

  if (userId) {
    await prisma.cartSnapshot.upsert({
      where: { userId },
      create: { userId, itemsJson, itemCount },
      update: { itemsJson, itemCount, reminderSentAt: null },
    });
  } else {
    await prisma.anonymousCartSnapshot.upsert({
      where: { anonymousId: anonymousId! },
      create: { anonymousId: anonymousId!, itemsJson, itemCount },
      update: { itemsJson, itemCount },
    });
  }

  const response = NextResponse.json({ ok: true, anonymous: !userId });
  if (!userId && !anonymousCookie) response.cookies.set("fikastore_anon_cart", anonymousId!, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 90, path: "/" });
  return response;
}
