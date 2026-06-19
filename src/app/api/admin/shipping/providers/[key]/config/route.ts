import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { getProviderFields, invalidateProviderConfig, listProviderConfig } from "@/lib/shippingProviderConfig";
import type { ShippingCarrierKey } from "@/lib/shippingCarriers";

export const runtime = "nodejs";

function isValidProvider(k: string): k is ShippingCarrierKey {
  return k === "epick" || k === "andreani" || k === "correo" || k === "pickup";
}

function deny() {
  return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
}

export async function GET(
  _: Request,
  { params }: { params: { key?: string } | Promise<{ key?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return deny();

  const resolved = await Promise.resolve(params);
  const key = String(resolved?.key || "").trim();
  if (!isValidProvider(key)) {
    return NextResponse.json({ ok: false, error: "Proveedor inválido." }, { status: 400 });
  }

  const fields = await listProviderConfig(key);
  return NextResponse.json({ ok: true, provider: key, fields });
}

export async function PATCH(
  req: Request,
  { params }: { params: { key?: string } | Promise<{ key?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return deny();

  const resolved = await Promise.resolve(params);
  const key = String(resolved?.key || "").trim();
  if (!isValidProvider(key)) {
    return NextResponse.json({ ok: false, error: "Proveedor inválido." }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { values?: Record<string, string> } | null;
  const values = body?.values;
  if (!values || typeof values !== "object") {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  const allowed = new Set(getProviderFields(key).map((f) => f.key));
  const entries = Object.entries(values).filter(([k]) => allowed.has(k));

  await prisma.$transaction(async (tx) => {
    for (const [cfgKey, raw] of entries) {
      const value = String(raw ?? "").trim();
      const isSecret = Boolean(getProviderFields(key).find((f) => f.key === cfgKey)?.secret);
      if (!value) {
        await tx.shippingProviderSetting.deleteMany({ where: { provider: key, key: cfgKey } });
        continue;
      }
      await tx.shippingProviderSetting.upsert({
        where: { provider_key: { provider: key, key: cfgKey } },
        update: { value, isSecret },
        create: { provider: key, key: cfgKey, value, isSecret },
      });
    }
  });

  invalidateProviderConfig(key);
  const fields = await listProviderConfig(key);
  return NextResponse.json({ ok: true, provider: key, fields });
}
