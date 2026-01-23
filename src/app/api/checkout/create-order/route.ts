import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

type Body = {
  items: { productId: string; quantity: number }[];
  shipping: {
    name: string;
    phone: string;
    addressLine: string;
    city: string;
    zip: string;
  };
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function POST(req: Request) {
  // ✅ requiere usuario logueado (como dijiste: para pagar tiene que tener cuenta)
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return bad("Tenés que iniciar sesión para continuar.", 401);

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return bad("Body inválido.");

  const items = Array.isArray(body.items) ? body.items : [];
  const shipping = body.shipping;

  if (items.length === 0) return bad("El carrito está vacío.");

  if (
    !shipping?.name?.trim() ||
    !shipping?.phone?.trim() ||
    !shipping?.addressLine?.trim() ||
    !shipping?.city?.trim() ||
    !shipping?.zip?.trim()
  ) {
    return bad("Completá todos los datos de envío.");
  }

  // normalizamos y validamos cantidades
  const normalized = items
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

  if (normalized.length === 0) return bad("Items inválidos.");

  // merge por productId (por si viene duplicado)
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
      // Traemos productos
      const products = await tx.product.findMany({
        where: { id: { in: merged.map((x) => x.productId) } },
        select: { id: true, name: true, price: true, stock: true, isActive: true },
      });

      const byId = new Map(products.map((p) => [p.id, p]));

      // Validaciones de existencia / activo / stock
      for (const it of merged) {
        const p = byId.get(it.productId);
        if (!p) {
          throw new Error(`Producto no encontrado: ${it.productId}`);
        }
        if (!p.isActive) {
          throw new Error(`El producto "${p.name}" no está disponible.`);
        }
        if (p.stock < it.quantity) {
          throw new Error(`Stock insuficiente para "${p.name}". Disponible: ${p.stock}.`);
        }
      }

      // Calcular total (Decimal)
      let total = new Prisma.Decimal(0);

      const orderItemsData = merged.map((it) => {
        const p = byId.get(it.productId)!;
        const unitPrice = new Prisma.Decimal(p.price as any); // p.price ya es Decimal
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

      // ✅ Crear orden + items + descontar stock (todo dentro de la misma TX)
      const order = await tx.order.create({
        data: {
          userId,
          status: "pending_payment",
          total,
          shippingName: shipping.name.trim(),
          shippingPhone: shipping.phone.trim(),
          shippingAddressLine: shipping.addressLine.trim(),
          shippingCity: shipping.city.trim(),
          shippingZip: shipping.zip.trim(),
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

      // Descontar stock
      for (const it of merged) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      return { orderId: order.id };
    });

    return NextResponse.json({ ok: true, orderId: result.orderId });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "No se pudo crear el pedido.";
    return bad(msg, 400);
  }
}
