import { NextResponse } from "next/server";
import { getShippingCarriers } from "@/lib/shippingCarriers";

export const runtime = "nodejs";

export async function GET() {
  const carriers = await getShippingCarriers();
  return NextResponse.json({
    ok: true,
    carriers: carriers.map((c) => ({ key: c.key, name: c.name, enabled: c.enabled })),
  });
}

