import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import {
  normalizePromoCode,
  parsePromotionPaymentMethods,
  parsePromotionFreeShippingDeliveryTypes,
  parsePromotionFreeShippingCarrierKeys,
  type PromotionFreeShippingDeliveryType,
  type PromotionPaymentMethod,
  type PromotionType,
} from "@/lib/promotions";

export const runtime = "nodejs";

type UpdateBody = {
  name?: string;
  type?: PromotionType;
  percent?: number;
  code?: string | null;
  freeShipping?: boolean;
  freeShippingDeliveryTypes?: string[];
  freeShippingCarrierKeys?: string[];
  paymentMethods?: string[];
  productIds?: string[];
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
};

const allowedPaymentMethods = new Set<PromotionPaymentMethod>(["mercadopago", "agreement", "cash", "transfer"]);
const allowedFreeShippingDeliveryTypes = new Set<PromotionFreeShippingDeliveryType>(["D", "S"]);

function parseDate(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizePaymentMethods(value: unknown) {
  if (!Array.isArray(value)) return null;
  const methods = [
    ...new Set(
      value
        .map((method) => String(method || "").trim())
        .filter((method): method is PromotionPaymentMethod => allowedPaymentMethods.has(method as PromotionPaymentMethod))
    ),
  ];
  return methods.length > 0 ? methods : null;
}

function normalizeFreeShippingDeliveryTypes(value: unknown) {
  if (!Array.isArray(value)) return null;
  const types = [
    ...new Set(
      value
        .map((type) => String(type || "").trim().toUpperCase())
        .filter((type): type is PromotionFreeShippingDeliveryType =>
          allowedFreeShippingDeliveryTypes.has(type as PromotionFreeShippingDeliveryType)
        )
    ),
  ];
  return types.length > 0 ? types : null;
}

function normalizeFreeShippingCarrierKeys(value: unknown) {
  if (!Array.isArray(value)) return null;
  const keys = [
    ...new Set(
      value
        .map((key) => String(key || "").trim())
        .filter((key) => key.length > 0 && key.length <= 80)
    ),
  ];
  return keys.length > 0 ? keys : null;
}

export async function PATCH(
  req: Request,
  { params }: { params: { id?: string } | Promise<{ id?: string }> }
) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const resolvedParams = await Promise.resolve(params);
  const id = String(resolvedParams?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Id inválido." }, { status: 400 });

  const body = (await req.json().catch(() => null)) as UpdateBody | null;
  if (!body) {
    return NextResponse.json({ ok: false, error: "Payload inválido." }, { status: 400 });
  }

  if (Object.keys(body).length === 1 && typeof body.isActive === "boolean") {
    const updated = await prisma.promotion.update({
      where: { id },
      data: { isActive: body.isActive },
      select: { id: true, isActive: true },
    });

    return NextResponse.json({ ok: true, promotion: updated });
  }

  const existing = await prisma.promotion.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "Promoción no encontrada." }, { status: 404 });

  const name = String(body.name || "").trim();
  const type = String(body.type || "").trim().toLowerCase() as PromotionType;
  const freeShipping = body.freeShipping === true;
  const percent = freeShipping ? 0 : Math.floor(Number(body.percent));
  const code = normalizePromoCode(body.code ?? null);
  const freeShippingDeliveryTypes = normalizeFreeShippingDeliveryTypes(body.freeShippingDeliveryTypes);
  const freeShippingCarrierKeys = normalizeFreeShippingCarrierKeys(body.freeShippingCarrierKeys);
  const startsAt = parseDate(body.startsAt);
  const endsAt = parseDate(body.endsAt);
  const paymentMethods = normalizePaymentMethods(body.paymentMethods);
  const rawIds = Array.isArray(body.productIds) ? body.productIds : [];
  const productIds = [...new Set(rawIds.map((productId) => String(productId || "").trim()).filter(Boolean))];

  if (!name) return NextResponse.json({ ok: false, error: "Nombre requerido." }, { status: 400 });
  if (!["global", "product", "code"].includes(type)) {
    return NextResponse.json({ ok: false, error: "Tipo inválido." }, { status: 400 });
  }
  if (!Number.isFinite(percent) || percent < 0 || percent >= 100 || (!freeShipping && percent <= 0)) {
    return NextResponse.json(
      { ok: false, error: freeShipping ? "Porcentaje inválido (0-99)." : "Porcentaje inválido (1-99)." },
      { status: 400 }
    );
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
    const exists = await prisma.promotion.findFirst({ where: { code, NOT: { id } }, select: { id: true } });
    if (exists) return NextResponse.json({ ok: false, error: "Ese código ya existe." }, { status: 409 });
  }

  const updated = await prisma.promotion.update({
    where: { id },
    data: {
      name,
      type,
      percent,
      code: code || null,
      freeShipping,
      freeShippingDeliveryTypes: freeShipping && freeShippingDeliveryTypes ? JSON.stringify(freeShippingDeliveryTypes) : null,
      freeShippingCarrierKeys: freeShipping && freeShippingCarrierKeys ? JSON.stringify(freeShippingCarrierKeys) : null,
      paymentMethods: paymentMethods ? JSON.stringify(paymentMethods) : null,
      startsAt,
      endsAt,
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      products: {
        deleteMany: {},
        ...(type === "product" ? { create: productIds.map((productId) => ({ productId })) } : {}),
      },
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
      id: updated.id,
      name: updated.name,
      type: updated.type,
      percent: updated.percent,
      code: updated.code,
      freeShipping: updated.freeShipping,
      freeShippingDeliveryTypes: parsePromotionFreeShippingDeliveryTypes(updated.freeShippingDeliveryTypes),
      freeShippingCarrierKeys: parsePromotionFreeShippingCarrierKeys(updated.freeShippingCarrierKeys),
      paymentMethods: parsePromotionPaymentMethods(updated.paymentMethods),
      isActive: updated.isActive,
      startsAt: updated.startsAt,
      endsAt: updated.endsAt,
      products: updated.products.map((pp) => pp.product),
      createdAt: updated.createdAt,
    },
  });
}
