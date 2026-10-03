import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMercadoPagoOAuthPaymentContext } from "@/lib/storeSettings";
import { buildPublicOrderUrl, getOrderContactEmail, normalizeOrderEmail } from "@/lib/orderAccess";
import { isStaffRole } from "@/lib/roles";
import { publicBaseUrl } from "@/lib/publicUrl";

export const runtime = "nodejs";

type CardPaymentBody = {
  orderId?: string;
  token?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  issuer_id?: string | number;
  installments?: number;
  transaction_amount?: number | string;
  device_id?: string;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
};

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function normalizeStatus(mpStatus: string | undefined): string {
  if (!mpStatus) return "unknown";
  const s = mpStatus.toLowerCase();
  if (s === "approved" || s === "processed" || s === "accredited") return "approved";
  if (s === "rejected" || s === "failed") return "rejected";
  if (s === "cancelled") return "cancelled";
  if (s === "refunded" || s === "charged_back") return "refunded";
  if (s === "pending" || s === "in_process" || s === "processing" || s === "authorized" || s === "action_required") return "pending";
  return "unknown";
}

function sanitizeMercadoPagoPayment(payment: Record<string, unknown>) {
  const copy = { ...payment };
  delete copy.card;
  delete copy.point_of_interaction;
  return JSON.stringify(copy).slice(0, 4000);
}

function paymentMessage(status: string, statusDetail?: string) {
  if (status === "approved") return "Pago aprobado.";
  if (status === "pending") return "Estamos procesando tu pago.";
  if (status === "rejected") {
    if (statusDetail?.includes("cc_rejected_insufficient_amount")) return "La tarjeta no tiene fondos suficientes.";
    if (statusDetail?.includes("cc_rejected_bad_filled")) return "Revisá los datos de la tarjeta e intentá nuevamente.";
    return "El pago fue rechazado. Podés intentar nuevamente con otra tarjeta.";
  }
  return "No se pudo confirmar el estado del pago.";
}

function paymentTypeId(value: string): "credit_card" | "debit_card" | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "credit_card" || normalized === "debit_card") return normalized;
  return null;
}

function mercadoPagoErrorMessage(data: Record<string, unknown>) {
  const message = typeof data.message === "string" ? data.message : "";
  const error = typeof data.error === "string" ? data.error : "";
  const firstCause = Array.isArray(data.cause) ? data.cause[0] as { description?: unknown; code?: unknown } | undefined : undefined;
  const causeDescription = typeof firstCause?.description === "string" ? firstCause.description : "";
  const causeCode = typeof firstCause?.code === "string" ? firstCause.code : "";
  return [causeDescription, message, error, causeCode].find((item) => item && item.trim()) || "";
}

function sanitizeForLog(value: unknown): unknown {
  const serialized = JSON.stringify(value, (key, item: unknown) => {
    if (/token|card|cvv|security|email|identification|document/i.test(key)) return "[redacted]";
    if (key === "shipment") return "[omitted]";
    return item;
  });
  return serialized ? JSON.parse(serialized) as unknown : null;
}

async function fetchMercadoPagoUserDiagnostics(accessToken: string) {
  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    return {
      status: response.status,
      requestId: response.headers.get("x-request-id") || undefined,
      userId: data.id !== undefined ? String(data.id) : undefined,
      nickname: typeof data.nickname === "string" ? data.nickname : undefined,
      siteId: typeof data.site_id === "string" ? data.site_id : undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "request failed",
    };
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role;
  const body = (await req.json().catch(() => null)) as CardPaymentBody | null;

  const orderId = String(body?.orderId || "").trim();
  const token = String(body?.token || "").trim();
  const paymentMethodId = String(body?.payment_method_id || "").trim();
  const rawPaymentType = String(body?.payment_type_id || "");
  const paymentType = paymentTypeId(rawPaymentType);
  const installments = Math.max(1, Math.floor(Number(body?.installments || 1)));
  const deviceId = String(body?.device_id || "").trim();
  const payerEmail = normalizeOrderEmail(body?.payer?.email);
  const identificationType = String(body?.payer?.identification?.type || "DNI").trim() || "DNI";
  const identificationNumber = String(body?.payer?.identification?.number || "").replace(/\D/g, "");

  if (!orderId) return bad("Orden inválida.");
  if (!token) return bad("Token de tarjeta inválido.");
  if (!paymentMethodId) return bad("Medio de pago inválido.");
  if (!paymentType) return bad("Tipo de tarjeta inválido.");
  if (!payerEmail) return bad("Email inválido.");

  const order = await prisma.order.findFirst({
    where: { id: orderId },
    include: {
      user: { select: { email: true } },
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  const canAccess = order
    ? isStaffRole(role) || (userId && order.userId === userId) || getOrderContactEmail(order) === payerEmail
    : false;

  if (!order || !canAccess) return bad("Orden no encontrada.", 404);
  if (order.status !== "pending_payment") return bad("Esta orden ya no está pendiente de pago.", 409);

  const latestPayment = order.payments[0];
  if (latestPayment?.provider && latestPayment.provider !== "mercadopago") {
    return bad("Este pedido fue creado con otro medio de pago.", 409);
  }

  const oauthContext = await getMercadoPagoOAuthPaymentContext();
  if (!oauthContext?.accessToken) {
    return bad("La cuenta de Mercado Pago del vendedor no está conectada por OAuth.", 503);
  }
  const { accessToken, connectedUserId, scope, tokenType } = oauthContext;

  const site = publicBaseUrl(req);
  const transactionAmount = Number(order.total);
  const idempotencyKey = randomUUID();

  const orderBody = {
    type: "online",
    external_reference: order.id,
    total_amount: transactionAmount.toFixed(2),
    processing_mode: "automatic",
    capture_mode: "automatic",
    description: `Pedido ${order.orderNumber ? `#${order.orderNumber}` : order.id}`,
    transactions: {
      payments: [
        {
          amount: transactionAmount.toFixed(2),
          payment_method: {
            id: paymentMethodId,
            type: paymentType,
            token,
            installments,
            statement_descriptor: "FIKASTORE",
          },
        },
      ],
    },
    payer: {
      email: payerEmail,
      entity_type: "individual",
      identification: identificationNumber
        ? {
            type: identificationType,
            number: identificationNumber,
          }
        : undefined,
    },
    shipment: {
      address: {
        zip_code: order.shippingZip,
        state: order.shippingProvince,
        city: order.shippingCity,
        street_name: order.shippingAddressLine,
      },
    },
    items: order.items.map((item) => ({
      title: item.nameSnapshot,
      unit_price: Number(item.unitPrice).toFixed(2),
      quantity: item.quantity,
      external_code: item.productVariantId || item.productId,
      description: item.nameSnapshot,
      category_id: "fashion",
    })),
  };

  const debugEnabled = process.env.MERCADOPAGO_DEBUG === "true";
  if (debugEnabled) {
    console.info("[MercadoPago Orders Debug]", {
      store: "storefront",
      orderId: order.id,
      oauthUserId: connectedUserId || null,
      oauthScope: scope || null,
      oauthTokenType: tokenType || null,
      accessTokenPresent: true,
      accessTokenPrefix: `${accessToken.slice(0, 8)}...`,
      accessTokenSuffix: `...${accessToken.slice(-4)}`,
      cardTokenPresent: true,
      paymentMethodId,
      paymentTypeId: rawPaymentType,
      installments,
      issuerIdReceived: body?.issuer_id !== undefined && body.issuer_id !== null,
      amount: transactionAmount.toFixed(2),
      brickAmount: body?.transaction_amount ?? null,
      payerEmailPresent: Boolean(payerEmail),
      idempotencyKey,
      endpoint: "/v1/orders",
      headers: {
        authorization: "Bearer [redacted OAuth token]",
        contentType: "application/json",
        idempotencyKeyPresent: Boolean(idempotencyKey),
        deviceIdPresent: Boolean(deviceId),
      },
      payload: sanitizeForLog(orderBody),
    });

    const userDiagnostics = await fetchMercadoPagoUserDiagnostics(accessToken);
    console.info("[MercadoPago OAuth Debug] GET /users/me", {
      ...userDiagnostics,
      oauthUserId: connectedUserId || null,
      responseUserId: "userId" in userDiagnostics ? userDiagnostics.userId || null : null,
      userIdMatches: connectedUserId && "userId" in userDiagnostics && userDiagnostics.userId
        ? connectedUserId === userDiagnostics.userId
        : null,
    });
  }

  const mpRes = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
      ...(deviceId ? { "X-meli-session-id": deviceId } : {}),
    },
    body: JSON.stringify(orderBody),
  });

  const mpData = (await mpRes.json().catch(() => ({}))) as Record<string, unknown>;
  const mpPayments =
    mpData.transactions &&
    typeof mpData.transactions === "object" &&
    Array.isArray((mpData.transactions as { payments?: unknown }).payments)
      ? (mpData.transactions as { payments: Record<string, unknown>[] }).payments
      : [];
  const mpPayment = mpPayments[0] || {};
  const rawStatus =
    typeof mpPayment.status === "string"
      ? mpPayment.status
      : typeof mpData.status === "string"
        ? mpData.status
        : undefined;
  const status = normalizeStatus(rawStatus);
  const statusDetail =
    typeof mpPayment.status_detail === "string"
      ? mpPayment.status_detail
      : typeof mpData.status_detail === "string"
        ? mpData.status_detail
        : null;
  const paymentId = mpPayment.id !== undefined && mpPayment.id !== null
    ? String(mpPayment.id)
    : mpData.id !== undefined && mpData.id !== null
      ? String(mpData.id)
      : null;

  if (!mpRes.ok) {
    const safeDetail = mercadoPagoErrorMessage(mpData);
    const mpRequestId = mpRes.headers.get("x-request-id") || mpRes.headers.get("x-correlation-id") || undefined;
    if (mpRes.status === 403 && mpData.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES") {
      const userDiagnostics = await fetchMercadoPagoUserDiagnostics(accessToken);
      console.error("Mercado Pago Orders policy diagnostics", {
        ...userDiagnostics,
        oauthUserId: connectedUserId || null,
        responseUserId: "userId" in userDiagnostics ? userDiagnostics.userId || null : null,
        userIdMatches: connectedUserId && "userId" in userDiagnostics && userDiagnostics.userId
          ? connectedUserId === userDiagnostics.userId
          : null,
        oauthScope: scope || null,
        oauthTokenType: tokenType || null,
      });
    }
    console.error("Mercado Pago Orders ERROR", {
      status: mpRes.status,
      requestId: mpRequestId,
      code: typeof mpData.code === "string" ? mpData.code : undefined,
      message: typeof mpData.message === "string" ? mpData.message : undefined,
      error: typeof mpData.error === "string" ? mpData.error : undefined,
      errors: Array.isArray(mpData.errors) ? mpData.errors : undefined,
      cause: Array.isArray(mpData.cause) ? mpData.cause : undefined,
      responseBody: sanitizeForLog(mpData),
    });
    return bad(
      safeDetail
        ? `Mercado Pago rechazó la solicitud: ${safeDetail}`
        : "Mercado Pago rechazó la solicitud. Revisá los datos e intentá nuevamente.",
      502
    );
  }

  await prisma.payment.upsert({
    where: { id: latestPayment?.id || "__missing__" },
    create: {
      orderId: order.id,
      provider: "mercadopago",
      status,
      paymentId,
      rawJson: sanitizeMercadoPagoPayment(mpData),
      pendingAt: status === "pending" ? new Date() : undefined,
    },
    update: {
      status,
      paymentId,
      rawJson: sanitizeMercadoPagoPayment(mpData),
      pendingAt: status === "pending" ? latestPayment?.pendingAt || new Date() : latestPayment?.pendingAt,
    },
  });

  return NextResponse.json({
    ok: true,
    status,
    statusDetail,
    paymentId,
    message: paymentMessage(status, statusDetail || undefined),
    orderUrl: buildPublicOrderUrl(site, order),
  });
}
