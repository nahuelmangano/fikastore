import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getShippingCarriers, type ShippingCarrierKey } from "@/lib/shippingCarriers";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

function deny() {
  return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
}

function isValidKey(k: string): k is ShippingCarrierKey {
  return k === "epick" || k === "andreani" || k === "correo" || k === "pickup";
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!isStaffRole(role)) return deny();

  const carriers = await getShippingCarriers();
  return NextResponse.json({
    ok: true,
    carriers: carriers.map((c) => ({ key: c.key, name: c.name, enabled: c.enabled })),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role as string | undefined;
  if (!isStaffRole(role)) return deny();

  const body = (await req.json().catch(() => null)) as { key?: string; enabled?: boolean } | null;
  const key = String(body?.key || "").trim();
  const enabled = body?.enabled;

  if (!isValidKey(key) || typeof enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const carriers = await getShippingCarriers();
  const found = carriers.find((c) => c.key === key);
  if (!found) {
    return NextResponse.json({ ok: false, error: "Carrier inexistente." }, { status: 404 });
  }

  const updated = await prisma.shippingCarrier.update({
    where: { key },
    data: { enabled },
  });

  return NextResponse.json({
    ok: true,
    carrier: { key: updated.key, name: updated.name, enabled: updated.enabled },
  });
}
