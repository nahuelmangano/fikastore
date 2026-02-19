import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import { normalizePromoCode, type PromotionType } from "@/lib/promotions";

export const runtime = "nodejs";

type CreateBody = {
  name?: string;
  type?: PromotionType;
  percent?: number;
  code?: string;
  productIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
};

function parseDate(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const promotions = await prisma.promotion.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      products: {
        select: {
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    promotions: promotions.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      percent: p.percent,
      code: p.code,
      isActive: p.isActive,
      startsAt: p.startsAt,
      endsAt: p.endsAt,
      products: p.products.map((pp) => pp.product),
      createdAt: p.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  const name = String(body?.name || "").trim();
  const type = String(body?.type || "").trim().toLowerCase() as PromotionType;
  const percent = Math.floor(Number(body?.percent));
  const code = normalizePromoCode(body?.code ?? null);
  const startsAt = parseDate(body?.startsAt);
  const endsAt = parseDate(body?.endsAt);
  const rawIds = Array.isArray(body?.productIds) ? body?.productIds : [];
  const productIds = [...new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean))];

  if (!name) return NextResponse.json({ ok: false, error: "Nombre requerido." }, { status: 400 });
  if (!["global", "product", "code"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });
  }
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) {
    return NextResponse.json({ ok: false, error: "Porcentaje inválido (1-99)." }, { status: 400 });
  }
  if (type === "code" && !code) {
    return NextResponse.json({ ok: false, error: "Código requerido para promo code." }, { status: 400 });
  }
  if (type !== "code" && code) {
    return NextResponse.json({ ok: false, error: "El código solo aplica a tipo code." }, { status: 400 });
  }
  if (type === "product" && productIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Seleccioná al menos 1 producto." }, { status: 400 });
  }
  if (startsAt && endsAt && startsAt > endsAt) {
    return NextResponse.json({ ok: false, error: "Rango de fechas inválido." }, { status: 400 });
  }

  if (code) {
    const exists = await prisma.promotion.findFirst({ where: { code } });
    if (exists) {
      return NextResponse.json({ ok: false, error: "Ese código ya existe." }, { status: 409 });
    }
  }

  const promotion = await prisma.promotion.create({
    data: {
      name,
      type,
      percent,
      code: code || null,
      startsAt,
      endsAt,
      products:
        type === "product"
          ? { create: productIds.map((productId) => ({ productId })) }
          : undefined,
    },
    include: {
      products: {
        select: {
          product: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    promotion: {
      id: promotion.id,
      name: promotion.name,
      type: promotion.type,
      percent: promotion.percent,
      code: promotion.code,
      isActive: promotion.isActive,
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
      products: promotion.products.map((pp) => pp.product),
      createdAt: promotion.createdAt,
    },
  });
}
