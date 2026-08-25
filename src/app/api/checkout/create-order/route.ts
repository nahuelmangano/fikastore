import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { getFreeShippingForCart, normalizePromoCode, priceCartItems } from "@/lib/promotions";
import { getCheckoutPaymentSettings, getEmailJobSettings, getTemporaryShutdownSettings } from "@/lib/storeSettings";
import { validateArgentinaPostalCodeProvince } from "@/lib/argentinaPostalCode";
import { publicBaseUrl } from "@/lib/publicUrl";
import { queueAndSendEmailNotification, scheduleEmailJob } from "@/lib/emailNotificationService";
import { emailOrderItemsHtml, emailOrderItemsText } from "@/lib/emailProductRows";
import { getShippingCarriers } from "@/lib/shippingCarriers";
import { transferInstructionsWithBankDetails } from "@/lib/manualPaymentInstructions";
import { buildPublicOrderUrl, getOrderContactEmail, getOrderCustomerName, normalizeOrderEmail } from "@/lib/orderAccess";

export const runtime = "nodejs";

type Body = {
  items: { productId: string; quantity: number }[];
  shipping: {
    name: string;
    email: string;
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
  paymentMethod?: string;
  promoCode?: string | null;
  notes?: string | null;
};

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function textLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function emailInfoBox(title: string, lines: string[]) {
  const cleanLines = lines.map((line) => line.trim()).filter(Boolean);
  if (cleanLines.length === 0) return "";

  return `
    <div style="margin:16px 0;">
      <p style="margin:0 0 8px;color:#111;font-weight:700;">${escapeHtml(title)}</p>
      <div style="border:1px solid #ddd;padding:14px 16px;color:#444;font-size:13px;line-height:1.6;">
        ${cleanLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
      </div>
    </div>
  `;
}

function emailShippingLabel(method: string, carrierName?: string | null, deliveryType?: string | null) {
  if (method === "epick") return "E-pick";
  if (method === "andreani") return "Andreani";
  if (method === "correo") return deliveryType === "S" ? "Correo Argentino - Sucursal" : "Correo Argentino - Domicilio";
  if (method === "pickup") return "Retiro en comercio";
  return carrierName || "Acordar envío";
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const temporaryShutdown = await getTemporaryShutdownSettings();
  if (temporaryShutdown.isShutdown) {
    return bad("La tienda se encuentra apagada temporalmente.", 403);
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return bad("Body invalido.");

  const items = Array.isArray(body.items) ? body.items : [];
  const shipping = body.shipping;
  const shippingMethod = String(body.shippingMethod || "").trim().toLowerCase();
  const paymentMethod = String(body.paymentMethod || "mercadopago").trim().toLowerCase();
  const shippingDeliveryType = String(body.shippingDeliveryType || "").trim().toUpperCase();
  const shippingBranch = body.shippingBranch;
  const notes = String(body.notes || "").replace(/\s+/g, " ").trim().slice(0, 1000);
  const contactEmail = normalizeOrderEmail(shipping?.email);

  if (items.length === 0) return bad("El carrito esta vacio.");
  if (!shipping?.name?.trim() || !contactEmail || !shipping?.phone?.trim()) {
    return bad("Completa nombre, email y telefono del destinatario.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return bad("Ingresá un email válido.");
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
  const checkoutCarriers = await getShippingCarriers({ visibleToMerchantOnly: true });
  const selectedCarrier = checkoutCarriers.find((carrier) => carrier.key === shippingMethod && carrier.enabled);
  if (!selectedCarrier) return bad("Seleccioná un método de envío válido.");

  const rawShippingAmount = Number(body.shippingAmount);
  const quotedShippingAmount = selectedCarrier.custom
    ? selectedCarrier.pricingMode === "agreement"
      ? 0
      : selectedCarrier.flatRate
    : Number.isFinite(rawShippingAmount) && rawShippingAmount >= 0
      ? rawShippingAmount
      : 0;
  const paymentSettings = await getCheckoutPaymentSettings();
  const manualPaymentMethod = paymentSettings.manualMethods.find((method) => method.key === paymentMethod && method.enabled);
  const validPaymentMethod =
    (paymentMethod === "mercadopago" && paymentSettings.mercadopagoEnabled) || Boolean(manualPaymentMethod);

  if (!validPaymentMethod) {
    return bad("Seleccioná un medio de pago válido.");
  }

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
  const promotionDeliveryType =
    shippingMethod === "correo" ? shippingDeliveryType || "D" : isPickup ? null : "D";
  const freeShipping = await getFreeShippingForCart(merged, promoCode, paymentMethod, promotionDeliveryType, shippingMethod);
  const shippingAmount = freeShipping.applies ? 0 : quotedShippingAmount;

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
      const priced = await priceCartItems(merged, promoCode, paymentMethod, promotionDeliveryType, shippingMethod);
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
          userId: userId || null,
          contactEmail,
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
          notes: notes ? `Nota del cliente: ${notes}` : null,
          items: { create: orderItemsData },
          payments: {
            create: {
              provider: paymentMethod,
              status: "pending",
              pendingAt: new Date(),
            },
          },
        },
        select: { id: true, orderNumber: true },
      });

      for (const it of merged) {
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      return { orderId: order.id, orderNumber: order.orderNumber };
    });

    const createdOrder = await prisma.order.findUnique({
      where: { id: result.orderId },
      include: {
        user: { select: { id: true, email: true, name: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        items: {
          include: {
            product: {
              include: {
                images: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1 },
              },
            },
          },
        },
      },
    });

    const orderEmail = createdOrder ? getOrderContactEmail(createdOrder) : "";
    if (createdOrder && orderEmail) {
      const payment = createdOrder.payments[0];
      const baseUrl = publicBaseUrl(req);
      const publicOrderUrl = buildPublicOrderUrl(baseUrl, createdOrder);
      const itemsSubtotal = createdOrder.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
      const paymentLabel = paymentMethod === "mercadopago" ? "Mercado Pago" : manualPaymentMethod?.label || "Pago manual";
      const basePaymentInstructions =
        paymentMethod === "mercadopago"
          ? "Podés completar el pago desde el enlace de tu pedido."
          : manualPaymentMethod?.instructions || "La tienda te contactará para coordinar el pago.";
      const paymentInstructions = paymentMethod === "transfer"
        ? transferInstructionsWithBankDetails(basePaymentInstructions, manualPaymentMethod?.bankDetails)
        : basePaymentInstructions;
      const shippingLabel = emailShippingLabel(shippingMethod, selectedCarrier.name, createdOrder.shippingDeliveryType);
      const shippingAddressLines =
        createdOrder.shippingMethod === "pickup"
          ? ["Retiro en comercio.", "Te vamos a contactar cuando el pedido esté listo para retirar."]
          : createdOrder.shippingMethod === "correo" && createdOrder.shippingDeliveryType === "S"
            ? [
                createdOrder.shippingBranchName ? `Sucursal: ${createdOrder.shippingBranchName}` : "Retiro en sucursal de Correo Argentino.",
                createdOrder.shippingAddressLine,
                [createdOrder.shippingCity, createdOrder.shippingProvince].filter(Boolean).join(", "),
                createdOrder.shippingZip ? `CP ${createdOrder.shippingZip}` : "",
              ]
            : [
                `Destinatario: ${createdOrder.shippingName}`,
                createdOrder.shippingPhone ? `Teléfono: ${createdOrder.shippingPhone}` : "",
                createdOrder.shippingAddressLine,
                [createdOrder.shippingCity, createdOrder.shippingProvince].filter(Boolean).join(", "),
                createdOrder.shippingZip ? `CP ${createdOrder.shippingZip}` : "",
              ];
      const shippingInstructions = [
        `Método de envío: ${shippingLabel}`,
        ...(selectedCarrier.description ? textLines(selectedCarrier.description) : []),
        ...shippingAddressLines,
      ];

      if (paymentMethod === "mercadopago" && payment?.id) {
        scheduleEmailJob({
          type: "payment-pending-initial",
          runAt: new Date(Date.now() + 20 * 60 * 1000),
          idempotencyKey: `payment-pending:${payment.id}`,
          orderId: createdOrder.id,
          paymentId: payment.id,
          payload: {
            paymentId: payment.id,
            orderId: createdOrder.id,
          },
        }).catch((error) => console.error("initial mercadopago pending email scheduling failed", error instanceof Error ? error.message : error));
      } else {
        queueAndSendEmailNotification({
          templateKey: "payment-pending",
          to: orderEmail,
          recipientUserId: createdOrder.user?.id,
          orderId: createdOrder.id,
          paymentId: payment?.id,
          idempotencyKey: `payment-pending:${payment?.id || createdOrder.id}`,
          payload: {
            customerName: getOrderCustomerName(createdOrder),
            orderNumber: `#${createdOrder.orderNumber}`,
            productsHtml: emailOrderItemsHtml(createdOrder.items, baseUrl, { subtotal: itemsSubtotal, shipping: createdOrder.shippingAmount, total: createdOrder.total }),
            productsText: emailOrderItemsText(createdOrder.items, { subtotal: itemsSubtotal, shipping: createdOrder.shippingAmount, total: createdOrder.total }),
            paymentAmount: `$${Number(createdOrder.total).toLocaleString("es-AR")}`,
            paymentMethod: paymentLabel,
            paymentInstructions,
            paymentDetailsHtml:
              paymentMethod === "mercadopago"
                ? ""
                : emailInfoBox(paymentMethod === "transfer" ? "Datos para transferencia" : paymentLabel, textLines(paymentInstructions)),
            shippingMethod: shippingLabel,
            shippingInstructions: shippingInstructions.join(". "),
            shippingDetailsHtml: emailInfoBox("Envío", shippingInstructions),
            paymentDueDate: "No informada",
            paymentUrl: publicOrderUrl,
            storeName: "FikaStore",
            storeUrl: baseUrl,
          },
        }).catch((error) => console.error("payment pending email queue failed", error instanceof Error ? error.message : error));
      }

      getEmailJobSettings()
        .then((emailJobSettings) => {
          if (!emailJobSettings.paymentRemindersEnabled || !payment?.id) return;

          return Promise.all(
            emailJobSettings.paymentReminderHours.slice(0, emailJobSettings.maxPaymentReminders).map((hours, index) =>
              scheduleEmailJob({
                type: "payment-reminder",
                runAt: new Date(Date.now() + hours * 60 * 60 * 1000),
                idempotencyKey: `payment-reminder:${payment.id}:${index + 1}`,
                orderId: createdOrder.id,
                paymentId: payment.id,
                payload: {
                  paymentId: payment.id,
                  orderId: createdOrder.id,
                  reminderNumber: index + 1,
                },
              })
            )
          );
        })
        .catch((error) => console.error("payment reminder scheduling failed", error instanceof Error ? error.message : error));
    }

    return NextResponse.json({ ok: true, orderId: result.orderId, orderNumber: result.orderNumber });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "No se pudo crear el pedido.";
    return bad(msg, 400);
  }
}
