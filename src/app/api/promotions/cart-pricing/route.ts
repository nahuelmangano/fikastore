import { NextResponse } from "next/server";
import { priceCartItems } from "@/lib/promotions";

export const runtime = "nodejs";

type Body = {
  items?: { productId: string; quantity: number }[];
  promoCode?: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !Array.isArray(body.items)) {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const pricing = await priceCartItems(body.items, body.promoCode ?? null);
  return NextResponse.json({ ok: true, pricing });
}
