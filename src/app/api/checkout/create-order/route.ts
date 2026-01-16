import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

type CartItemInput = {
  productId: string;
  quantity: number;
};

type Body = {
  items: CartItemInput[];
  shipping: {
    name: string;
    phone: string;
    addressLine: string;
    city: string;
    zip: string;
  };
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;

  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Usuario no encontrado. VolvÇ© a iniciar sesiÇ³n." },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body inválido." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ ok: false, error: "El carrito está vacío." }, { status: 400 });
  }

  const s = body.shipping || ({} as any);
  const shippingName = String(s.name || "").trim();
  const shippingPhone = String(s.phone || "").trim();
  const shippingAddressLine = String(s.addressLine || "").trim();
  const shippingCity = String(s.city || "").trim();
  const shippingZip = String(s.zip || "").trim();

  if (!shippingName || !shippingPhone || !shippingAddressLine || !shippingCity || !shippingZip) {
    return NextResponse.json(
      { ok: false, error: "Completá todos los datos de envío." },
      { status: 400 }
    );
  }

  // Normalizar cantidades
  const normalized = items
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      quantity: Number(it.quantity || 0),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0);

  if (normalized.length === 0) {
    return NextResponse.json({ ok: false, error: "Items inválidos." }, { status: 400 });
  }

  // Traer productos desde DB para validar precio/stock
  const productIds = [...new Set(normalized.map((x) => x.productId))];

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, isActive: true },
    include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });

  const byId = new Map(products.map((p) => [p.id, p]));

  // Validaciones + construir order items
  const orderItems: {
    productId: string;
    nameSnapshot: string;
    unitPrice: any; // Decimal as string is OK for Prisma
    quantity: number;
    subtotal: any;
  }[] = [];

  for (const it of normalized) {
    const p = byId.get(it.productId);
    if (!p) {
      return NextResponse.json(
        { ok: false, error: "Uno o más productos ya no están disponibles." },
        { status: 400 }
      );
    }

    const qty = Math.min(it.quantity, p.stock);
    if (qty <= 0) {
      return NextResponse.json(
        { ok: false, error: `Sin stock para: ${p.name}` },
        { status: 400 }
      );
    }

    const unitPriceNumber = Number(p.price);
    const subtotalNumber = unitPriceNumber * qty;

    orderItems.push({
      productId: p.id,
      nameSnapshot: p.name,
      unitPrice: unitPriceNumber.toFixed(2),
      quantity: qty,
      subtotal: subtotalNumber.toFixed(2),
    });
  }

  const totalNumber = orderItems.reduce((acc, it) => acc + Number(it.subtotal), 0);

  // Crear orden + items en transacción
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        status: "pending_payment",
        total: totalNumber.toFixed(2),
        shippingName,
        shippingPhone,
        shippingAddressLine,
        shippingCity,
        shippingZip,
        items: {
          create: orderItems.map((it) => ({
            productId: it.productId,
            nameSnapshot: it.nameSnapshot,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            subtotal: it.subtotal,
          })),
        },
      },
      include: { items: true },
    });

    // Reservar stock (simple MVP): descontamos al crear orden
    // Si después el pago vence/cancela, devolvemos stock.
    for (const it of orderItems) {
      await tx.product.update({
        where: { id: it.productId },
        data: { stock: { decrement: it.quantity } },
      });
    }

    return created;
  });

  return NextResponse.json({ ok: true, orderId: order.id });
}
