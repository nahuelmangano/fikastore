import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { normalizePromoCode, priceCartItems } from "@/lib/promotions";
import { getTemporaryShutdownSettings } from "@/lib/storeSettings";
import { validateArgentinaPostalCodeProvince } from "@/lib/argentinaPostalCode";

export const runtime = "nodejs";

type Body = {
  items: { productId: string; quantity: number }[];
  shipping: {
    name: string;
    phone: string;
    addressLine: string;
    city: string;
    province: string;
    provinceCode: string;
    zip: string;
  };
  shippingMethod?: string;
  shippingDeliveryType?: string;
  shippingBranch?: {
    code?: string;
    name?: string;
    addressLine?: string;
    city?: string;
    province?: string;
    provinceCode?: string;
    zip?: string;
  };
  shippingAmount?: number;
  promoCode?: string | null;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return bad("Tenes que iniciar sesion para continuar.", 401);

  const temporaryShutdown = await getTemporaryShutdownSettings();
  if (temporaryShutdown.isShutdown) {
    return bad("La tienda se encuentra apagada temporalmente.", 403);
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return bad("Body invalido.");

  const items = Array.isArray(body.items) ? body.items : [];
  const shipping = body.shipping;
  const shippingMethod = String(body.shippingMethod || "").trim().toLowerCase();
  const shippingDeliveryType = String(body.shippingDeliveryType || "").trim().toUpperCase();
  const shippingBranch = body.shippingBranch;

  if (items.length === 0) return bad("El carrito esta vacio.");
  if (!shipping?.name?.trim() || !shipping?.phone?.trim()) {
    return bad("Completa los datos del destinatario.");
  }

  const isPickup = shippingMethod === "pickup";
  const isCorreoBranch = shippingMethod === "correo" && shippingDeliveryType === "S";
  const effectiveShipping = isCorreoBranch
    ? {
        addressLine: String(shippingBranch?.addressLine || "").trim(),
        city: String(shippingBranch?.city || "").trim(),
        province: String(shippingBranch?.province || "").trim(),
        provinceCode: String(shippingBranch?.provinceCode || "").trim().toUpperCase(),
        zip: String(shippingBranch?.zip || "").trim(),
      }
    : {
        addressLine: String(shipping?.addressLine || "").trim(),
        city: String(shipping?.city || "").trim(),
        province: String(shipping?.province || "").trim(),
        provinceCode: String(shipping?.provinceCode || "").trim().toUpperCase(),
        zip: String(shipping?.zip || "").trim(),
      };

  if (isCorreoBranch && (!shippingBranch?.code?.trim() || !shippingBranch?.name?.trim())) {
    return bad("Selecciona una sucursal de Correo Argentino.");
  }

  if (
    !isPickup &&
    (!effectiveShipping.addressLine ||
      !effectiveShipping.city ||
      !effectiveShipping.province ||
      !effectiveShipping.provinceCode ||
      !effectiveShipping.zip)
  ) {
    return bad("Completa todos los datos de envio.");
  }

  if (!isPickup) {
    const postalCodeProvinceError = validateArgentinaPostalCodeProvince(
      effectiveShipping.zip,
      effectiveShipping.provinceCode
    );
    if (postalCodeProvinceError) return bad(postalCodeProvinceError);
  }

  const promoCode = normalizePromoCode(body.promoCode ?? null);
  const rawShippingAmount = Number(body.shippingAmount);
  const shippingAmount =
    Number.isFinite(rawShippingAmount) && rawShippingAmount >= 0 ? rawShippingAmount : 0;

  const normalized = items
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

  if (normalized.length === 0) return bad("Items invalidos.");

  const mergedMap = new Map<string, number>();
  for (const it of normalized) {
    mergedMap.set(it.productId, (mergedMap.get(it.productId) ?? 0) + it.quantity);
  }
  const merged = Array.from(mergedMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: merged.map((x) => x.productId) } },
        select: { id: true, name: true, price: true, stock: true, isActive: true },
      });

      const byId = new Map(products.map((p) => [p.id, p]));

      for (const it of merged) {
        const p = byId.get(it.productId);
        if (!p) {
          throw new Error(`Producto no encontrado: ${it.productId}`);
        }
        if (!p.isActive) {
          throw new Error(`El producto "${p.name}" no esta disponible.`);
        }
        if (p.stock < it.quantity) {
          throw new Error(`Stock insuficiente para "${p.name}". Disponible: ${p.stock}.`);
        }
      }

      let total = new Prisma.Decimal(0);
      const priced = await priceCartItems(merged, promoCode);
      const pricedById = new Map(priced.items.map((it) => [it.productId, it]));

      const orderItemsData = merged.map((it) => {
        const p = byId.get(it.productId)!;
        const unit = pricedById.get(it.productId)?.finalPrice ?? Number(p.price);
        const unitPrice = new Prisma.Decimal(unit.toFixed(2));
        const qty = new Prisma.Decimal(it.quantity);
        const subtotal = unitPrice.mul(qty);
        total = total.add(subtotal);

        return {
          productId: p.id,
          nameSnapshot: p.name,
          unitPrice,
          quantity: it.quantity,
          subtotal,
        };
      });

      const order = await tx.order.create({
        data: {
          userId,
          status: "pending_payment",
          total: total.add(new Prisma.Decimal(shippingAmount || 0)),
          shippingName: shipping.name.trim(),
          shippingPhone: shipping.phone.trim(),
          shippingAddressLine: effectiveShipping.addressLine,
          shippingCity: effectiveShipping.city,
          shippingProvince: effectiveShipping.province,
          shippingProvinceCode: effectiveShipping.provinceCode,
          shippingZip: effectiveShipping.zip,
          shippingMethod: shippingMethod || null,
          shippingDeliveryType: shippingMethod === "correo" ? shippingDeliveryType || "D" : null,
          shippingBranchCode: isCorreoBranch ? String(shippingBranch?.code || "").trim() : null,
          shippingBranchName: isCorreoBranch ? String(shippingBranch?.name || "").trim() : null,
          shippingAmount: new Prisma.Decimal(shippingAmount || 0),
          items: { create: orderItemsData },
          payments: {
            create: {
              provider: "mercadopago",
              status: "pending",
            },
          },
        },
        select: { id: true },
      });

      for (const it of merged) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      return { orderId: order.id };
    });

    return NextResponse.json({ ok: true, orderId: result.orderId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo crear el pedido.";
    return bad(msg, 400);
  }
}
