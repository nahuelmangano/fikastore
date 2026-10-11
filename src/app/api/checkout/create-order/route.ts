import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Prisma } from "@prisma/client";
import { getFreeShippingForCart, normalizePromoCode, priceCartItems } from "@/lib/promotions";
import { getCheckoutPaymentSettings, getEmailJobSettings, getTemporaryShutdownSettings } from "@/lib/storeSettings";
import { validateArgentinaPostalCodeProvince } from "@/lib/argentinaPostalCode";
import { scheduleEmailJob } from "@/lib/emailNotificationService";
import { getShippingCarriers } from "@/lib/shippingCarriers";
import { transferInstructionsWithBankDetails } from "@/lib/manualPaymentInstructions";
import { getMetaTrackingContext } from "@/lib/meta/context";
import { normalizeOrderEmail } from "@/lib/orderAccess";
import { dispatchOrderEmailNotifications, enqueueManualOrderCreatedEmailsInTransaction } from "@/lib/orderEmailNotifications";

export const runtime = "nodejs";

type Body = {
  items: { productId: string; productVariantId?: string | null; lineKey?: string; quantity: number }[];
  shipping: {
    name: string;
    dni: string;
    email: string;
    phone: string;
    addressLine: string;
    floor?: string;
    apartment?: string;
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
  const dni = String(shipping?.dni || "").replace(/\D/g, "");
  const shippingFloor = String(shipping?.floor || "").trim().slice(0, 3);
  const shippingApartment = String(shipping?.apartment || "").trim().slice(0, 3);
  const metaTracking = getMetaTrackingContext(req);

  if (items.length === 0) return bad("El carrito esta vacio.");
  if (!shipping?.name?.trim() || !dni || !contactEmail || !shipping?.phone?.trim()) {
    return bad("Completa nombre, DNI, email y telefono del destinatario.");
  }
  if (!/^\d{7,8}$/.test(dni)) return bad("Ingresá un DNI válido de 7 u 8 dígitos.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return bad("Ingresá un email válido.");
  }

  const promoCode = normalizePromoCode(body.promoCode ?? null);
  const checkoutCarriers = await getShippingCarriers({ visibleToMerchantOnly: true });
  const selectedCarrier = checkoutCarriers.find((carrier) => carrier.key === shippingMethod && carrier.enabled);
  if (!selectedCarrier) return bad("Seleccioná un método de envío válido.");

  const isPickup = shippingMethod === "pickup";
  const isCorreoBranch = shippingMethod === "correo" && shippingDeliveryType === "S";
  const selectedCustomPickupPoint =
    selectedCarrier.custom && selectedCarrier.pickupPoints.length > 0
      ? selectedCarrier.pickupPoints.find((point) => point.id === String(shippingBranch?.code || "").trim())
      : null;
  const isCustomPickupPoint = Boolean(selectedCustomPickupPoint);
  const effectiveShipping = isCorreoBranch
    ? {
        addressLine: String(shippingBranch?.addressLine || "").trim(),
        city: String(shippingBranch?.city || "").trim(),
        province: String(shippingBranch?.province || "").trim(),
        provinceCode: String(shippingBranch?.provinceCode || "").trim().toUpperCase(),
        zip: String(shippingBranch?.zip || "").trim(),
      }
    : selectedCustomPickupPoint
      ? {
          addressLine: selectedCustomPickupPoint.notes || selectedCustomPickupPoint.name,
          city: "",
          province: "",
          provinceCode: "",
          zip: "",
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

  if (selectedCarrier.custom && selectedCarrier.pickupPoints.length > 0 && !selectedCustomPickupPoint) {
    return bad("Seleccioná un punto de retiro.");
  }

  if (
    !isPickup &&
    !isCustomPickupPoint &&
    (!effectiveShipping.addressLine ||
      !effectiveShipping.city ||
      !effectiveShipping.province ||
      !effectiveShipping.provinceCode ||
      !effectiveShipping.zip)
  ) {
    return bad("Completa todos los datos de envio.");
  }

  const postalCodeValidationSource =
    isPickup || isCustomPickupPoint
      ? {
          zip: String(shipping?.zip || "").trim(),
          provinceCode: String(shipping?.provinceCode || "").trim().toUpperCase(),
        }
      : effectiveShipping;
  const postalCodeProvinceError = validateArgentinaPostalCodeProvince(
    postalCodeValidationSource.zip,
    postalCodeValidationSource.provinceCode
  );
  if (postalCodeProvinceError) return bad(postalCodeProvinceError);

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

  const paymentLabel = paymentMethod === "mercadopago" ? "Mercado Pago" : manualPaymentMethod?.label || "Pago manual";
  const basePaymentInstructions = paymentMethod === "mercadopago"
    ? "Podés completar el pago desde el enlace de tu pedido."
    : manualPaymentMethod?.instructions || "La tienda te contactará para coordinar el pago.";
  const paymentInstructions = paymentMethod === "transfer"
    ? transferInstructionsWithBankDetails(basePaymentInstructions, manualPaymentMethod?.bankDetails)
    : basePaymentInstructions;
  const paymentDetailsHtml = paymentMethod === "transfer"
    ? emailInfoBox("Datos para transferencia", textLines(paymentInstructions))
    : paymentMethod === "mercadopago"
      ? ""
      : emailInfoBox(paymentLabel, textLines(paymentInstructions));

  const normalized = items
    .map((it) => ({
      productId: String(it.productId || "").trim(),
      productVariantId: String(it.productVariantId || "").trim() || null,
      lineKey: String(it.lineKey || "").trim() || `${String(it.productId || "").trim()}:${String(it.productVariantId || "").trim() || ""}`,
      quantity: Math.floor(Number(it.quantity)),
    }))
    .filter((it) => it.productId && Number.isFinite(it.quantity) && it.quantity > 0 && it.lineKey);

  if (normalized.length === 0) return bad("Items invalidos.");

  const mergedMap = new Map<string, { productId: string; productVariantId: string | null; quantity: number; lineKey: string }>();
  for (const it of normalized) {
    const current = mergedMap.get(it.lineKey);
    mergedMap.set(it.lineKey, {
      productId: it.productId,
      productVariantId: it.productVariantId,
      lineKey: it.lineKey,
      quantity: (current?.quantity ?? 0) + it.quantity,
    });
  }
  const merged = Array.from(mergedMap.values());
  const promotionDeliveryType =
    shippingMethod === "correo" ? shippingDeliveryType || "D" : isPickup ? null : "D";
  const freeShipping = await getFreeShippingForCart(merged, promoCode, paymentMethod, promotionDeliveryType, shippingMethod);
  const shippingAmount = freeShipping.applies ? 0 : quotedShippingAmount;

  try {
    let emailNotificationIds: string[] = [];
    const result = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: merged.map((x) => x.productId) } },
        select: { id: true, name: true, sku: true, price: true, stock: true, isActive: true, hasVariants: true },
      });

      const byId = new Map(products.map((p) => [p.id, p]));
      const variantIds = [...new Set(merged.map((item) => item.productVariantId).filter(Boolean) as string[])];
      const variants = variantIds.length
        ? await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, productId: true, stock: true, sku: true, label: true, priceOverride: true, isActive: true },
          })
        : [];
      const variantsById = new Map(variants.map((variant) => [variant.id, variant]));

      for (const it of merged) {
        const p = byId.get(it.productId);
        if (!p) {
          throw new Error(`Producto no encontrado: ${it.productId}`);
        }
        if (!p.isActive) {
          throw new Error(`El producto "${p.name}" no esta disponible.`);
        }
        if (it.productVariantId) {
          const variant = variantsById.get(it.productVariantId);
          if (!variant || variant.productId !== it.productId || !variant.isActive) {
            throw new Error(`Variante inválida para "${p.name}".`);
          }
          if (variant.stock < it.quantity) {
            throw new Error(`Stock insuficiente para "${p.name}" (${variant.label}). Disponible: ${variant.stock}.`);
          }
        } else if (p.stock < it.quantity) {
          throw new Error(`Stock insuficiente para "${p.name}". Disponible: ${p.stock}.`);
        }
      }

      let total = new Prisma.Decimal(0);
      const priced = await priceCartItems(merged, promoCode, paymentMethod, promotionDeliveryType, shippingMethod);
      const pricedById = new Map(priced.items.map((it) => [it.lineKey, it]));

      const orderItemsData = merged.map((it) => {
        const p = byId.get(it.productId)!;
        const variant = it.productVariantId ? variantsById.get(it.productVariantId) : null;
        const unit =
          pricedById.get(it.lineKey)?.finalPrice ??
          (variant?.priceOverride !== null && variant?.priceOverride !== undefined ? Number(variant.priceOverride) : Number(p.price));
        const unitPrice = new Prisma.Decimal(unit.toFixed(2));
        const qty = new Prisma.Decimal(it.quantity);
        const subtotal = unitPrice.mul(qty);
        total = total.add(subtotal);

        return {
          productId: p.id,
          productVariantId: variant?.id || null,
          nameSnapshot: variant?.label ? `${p.name} · ${variant.label}` : p.name,
          variantSnapshot: variant?.label || null,
          skuSnapshot: variant?.sku || p.sku || null,
          unitPrice,
          quantity: it.quantity,
          subtotal,
        };
      });

      const order = await tx.order.create({
        data: {
          userId: userId || null,
          contactEmail,
          dni,
          billingName: shipping.name.trim(),
          billingPhone: shipping.phone.trim(),
          billingAddressLine: String(shipping?.addressLine || "").trim() || null,
          billingFloor: shippingFloor,
          billingApartment: shippingApartment,
          billingCity: String(shipping?.city || "").trim() || null,
          billingProvince: String(shipping?.province || "").trim() || null,
          billingProvinceCode: String(shipping?.provinceCode || "").trim().toUpperCase() || null,
          billingZip: String(shipping?.zip || "").trim() || null,
          status: "pending_payment",
          total: total.add(new Prisma.Decimal(shippingAmount || 0)),
          shippingName: shipping.name.trim(),
          shippingPhone: shipping.phone.trim(),
          shippingAddressLine: effectiveShipping.addressLine,
          shippingFloor,
          shippingApartment,
          shippingCity: effectiveShipping.city,
          shippingProvince: effectiveShipping.province,
          shippingProvinceCode: effectiveShipping.provinceCode,
          shippingZip: effectiveShipping.zip,
          shippingMethod: shippingMethod || null,
          shippingDeliveryType: shippingMethod === "correo" ? shippingDeliveryType || "D" : null,
          shippingBranchCode: isCorreoBranch || isCustomPickupPoint ? String(shippingBranch?.code || "").trim() : null,
          shippingBranchName: isCorreoBranch || isCustomPickupPoint ? String(shippingBranch?.name || selectedCustomPickupPoint?.name || "").trim() : null,
          shippingAmount: new Prisma.Decimal(shippingAmount || 0),
          notes: notes ? `Nota del cliente: ${notes}` : null,
          metaFbp: metaTracking.fbp,
          metaFbc: metaTracking.fbc,
          metaClientIpAddress: metaTracking.clientIpAddress,
          metaClientUserAgent: metaTracking.clientUserAgent,
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
        if (it.productVariantId) {
          await tx.productVariant.update({
            where: { id: it.productVariantId },
            data: { stock: { decrement: it.quantity } },
          });
        }
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }

      if (paymentMethod !== "mercadopago") {
        emailNotificationIds = await enqueueManualOrderCreatedEmailsInTransaction(tx, {
          orderId: order.id,
          paymentLabel,
          paymentInstructions,
          paymentDetailsHtml,
          req,
        });
      }

      return { orderId: order.id, orderNumber: order.orderNumber };
    });

    await dispatchOrderEmailNotifications(emailNotificationIds);

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

    if (createdOrder) {
      const payment = createdOrder.payments[0];
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
