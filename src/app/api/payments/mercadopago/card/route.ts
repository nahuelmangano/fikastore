import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getMercadoPagoOAuthPaymentContext } from "@/lib/storeSettings";
import { buildPublicOrderUrl, getOrderContactEmail, normalizeOrderEmail } from "@/lib/orderAccess";
import { isStaffRole } from "@/lib/roles";
import { publicBaseUrl } from "@/lib/publicUrl";
import {
  reconcileMercadoPagoFinancialConfirmation,
} from "@/lib/mercadoPagoPaymentConfirmation";
import { syncMetaPurchaseForOrder } from "@/lib/meta/conversionsApi";
import {
  assertMercadoPagoAttemptPayloadMatches,
  createMercadoPagoIdempotencyKey,
  hashMercadoPagoOrderPayload,
  isBlockingMercadoPagoAttempt,
  MP_ORDER_REQUEST_STATUSES,
  shouldTreatMercadoPagoOrderErrorAsUnknown,
} from "@/lib/mercadoPagoOrderAttempt";
import {
  buildMercadoPagoErrorDiagnostic,
  stringifyMercadoPagoErrorDiagnostic,
} from "@/lib/mercadoPagoErrorDiagnostics";

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
  payment_attempt_id?: string;
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

async function fetchMercadoPagoOrder(accessToken: string, mpOrderId: string) {
  const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(mpOrderId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`MP get order failed status=${response.status}`);
  }
  return data;
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
  const paymentAttemptId = String(body?.payment_attempt_id || "").trim();
  const payerEmail = normalizeOrderEmail(body?.payer?.email);
  const identificationType = String(body?.payer?.identification?.type || "DNI").trim() || "DNI";
  const identificationNumber = String(body?.payer?.identification?.number || "").replace(/\D/g, "");

  if (!orderId) return bad("Orden inválida.");
  if (!token) return bad("Token de tarjeta inválido.");
  if (!paymentMethodId) return bad("Medio de pago inválido.");
  if (!paymentType) return bad("Tipo de tarjeta inválido.");
  if (!paymentAttemptId || paymentAttemptId.length > 120) return bad("Intento de pago inválido.");
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
  if (connectedUserId) {
    const userDiagnostics = await fetchMercadoPagoUserDiagnostics(accessToken);
    const responseUserId = "userId" in userDiagnostics ? userDiagnostics.userId : undefined;
    if (responseUserId && responseUserId !== connectedUserId) {
      console.error("Mercado Pago OAuth seller mismatch", {
        oauthUserId: connectedUserId,
        responseUserId,
      });
      return bad("La cuenta de Mercado Pago conectada no coincide con el vendedor configurado.", 503);
    }
  }

  const site = publicBaseUrl(req);
  const transactionAmount = Number(order.total);

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
  const requestHash = hashMercadoPagoOrderPayload(orderBody);

  type PreparedAttempt = {
    paymentRowId: string;
    idempotencyKey: string;
    mpOrderId: string | null;
  };

  let preparedAttempt: PreparedAttempt;
  try {
    preparedAttempt = await prisma.$transaction(async (tx) => {
      const payments = await tx.payment.findMany({
        where: { orderId: order.id, provider: "mercadopago" },
        orderBy: { createdAt: "desc" },
      });

      const sameAttempt = payments.find((payment) => payment.paymentAttemptId === paymentAttemptId) ?? null;
      if (sameAttempt) {
        assertMercadoPagoAttemptPayloadMatches(sameAttempt, requestHash);
      }

      const blockingOtherAttempt = payments.find(
        (payment) => payment.paymentAttemptId !== paymentAttemptId && isBlockingMercadoPagoAttempt(payment),
      );
      if (blockingOtherAttempt) {
        throw new Error("mercadopago_active_attempt");
      }

      const reusableInitialPayment = payments.find(
        (payment) =>
          !payment.paymentAttemptId &&
          !payment.mpIdempotencyKey &&
          payment.status === "pending",
      ) ?? null;
      const targetPayment = sameAttempt ?? reusableInitialPayment;

      if (targetPayment) {
        const idempotencyKey = targetPayment.mpIdempotencyKey || createMercadoPagoIdempotencyKey();
        const updated = await tx.payment.update({
          where: { id: targetPayment.id },
          data: {
            paymentAttemptId,
            mpIdempotencyKey: idempotencyKey,
            mpRequestHash: requestHash,
            mpRequestStatus: targetPayment.mpOrderId
              ? targetPayment.mpRequestStatus
              : MP_ORDER_REQUEST_STATUSES.processing,
            mpRequestStartedAt: targetPayment.mpRequestStartedAt ?? new Date(),
            mpLastError: null,
          },
        });
        return {
          paymentRowId: updated.id,
          idempotencyKey,
          mpOrderId: updated.mpOrderId,
        };
      }

      const created = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "mercadopago",
          status: "pending",
          paymentAttemptId,
          mpIdempotencyKey: createMercadoPagoIdempotencyKey(),
          mpRequestHash: requestHash,
          mpRequestStatus: MP_ORDER_REQUEST_STATUSES.processing,
          mpRequestStartedAt: new Date(),
          pendingAt: new Date(),
        },
      });

      return {
        paymentRowId: created.id,
        idempotencyKey: created.mpIdempotencyKey!,
        mpOrderId: created.mpOrderId,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "mercadopago_attempt_payload_mismatch") {
      return bad("Este intento de pago ya fue enviado con otros datos. Esperá la confirmación o iniciá un nuevo pago.", 409);
    }
    if (message === "mercadopago_active_attempt") {
      return bad("Ya hay un intento de pago en curso para esta orden. Esperá la confirmación de Mercado Pago antes de reintentar.", 409);
    }
    throw error;
  }

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
      idempotencyKey: preparedAttempt.idempotencyKey,
      endpoint: "/v1/orders",
      headers: {
        authorization: "Bearer [redacted OAuth token]",
        contentType: "application/json",
        idempotencyKeyPresent: Boolean(preparedAttempt.idempotencyKey),
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

  let mpRes: Response | null = null;
  let mpData: Record<string, unknown>;
  try {
    if (preparedAttempt.mpOrderId) {
      mpData = await fetchMercadoPagoOrder(accessToken, preparedAttempt.mpOrderId);
    } else {
      mpRes = await fetch("https://api.mercadopago.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": preparedAttempt.idempotencyKey,
          ...(deviceId ? { "X-meli-session-id": deviceId } : {}),
        },
        body: JSON.stringify(orderBody),
        signal: AbortSignal.timeout(20000),
      });
      mpData = (await mpRes.json().catch(() => ({}))) as Record<string, unknown>;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    await prisma.payment.update({
      where: { id: preparedAttempt.paymentRowId },
      data: {
        status: "unknown",
        mpRequestStatus: MP_ORDER_REQUEST_STATUSES.unknown,
        mpLastError: message.slice(0, 1000),
      },
    });
    return NextResponse.json({
      ok: true,
      status: "unknown",
      paymentId: null,
      message: "No pudimos confirmar el resultado del pago. No vuelvas a enviar los datos de tarjeta; vamos a recuperar el estado con Mercado Pago.",
      orderUrl: buildPublicOrderUrl(site, order),
    }, { status: 202 });
  }

  const mpPayments =
    mpData.transactions &&
    typeof mpData.transactions === "object" &&
    Array.isArray((mpData.transactions as { payments?: unknown }).payments)
      ? (mpData.transactions as { payments: Record<string, unknown>[] }).payments
      : [];
  const mpPayment = mpPayments[0] || {};
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

  if (mpRes && !mpRes.ok) {
    const safeDetail = mercadoPagoErrorMessage(mpData);
    const mpRequestId = mpRes.headers.get("x-request-id") || mpRes.headers.get("x-correlation-id") || undefined;
    const code = typeof mpData.code === "string" ? mpData.code : undefined;
    const mpErrorDiagnostic = buildMercadoPagoErrorDiagnostic({
      status: mpRes.status,
      requestId: mpRequestId,
      body: mpData,
    });
    const requestStatus = shouldTreatMercadoPagoOrderErrorAsUnknown(mpRes.status, code)
      ? MP_ORDER_REQUEST_STATUSES.unknown
      : MP_ORDER_REQUEST_STATUSES.failed;
    await prisma.payment.update({
      where: { id: preparedAttempt.paymentRowId },
      data: {
        status: requestStatus === MP_ORDER_REQUEST_STATUSES.unknown ? "unknown" : "rejected",
        mpRequestStatus: requestStatus,
        mpRequestFinishedAt: requestStatus === MP_ORDER_REQUEST_STATUSES.failed ? new Date() : undefined,
        mpLastError: stringifyMercadoPagoErrorDiagnostic(mpErrorDiagnostic),
      },
    });

    if (requestStatus === MP_ORDER_REQUEST_STATUSES.unknown) {
      return NextResponse.json({
        ok: true,
        status: "unknown",
        paymentId: null,
        message: "Mercado Pago no devolvió un resultado definitivo. No se enviará otro cobro automáticamente.",
        orderUrl: buildPublicOrderUrl(site, order),
      }, { status: 202 });
    }

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
    console.error("Mercado Pago Orders ERROR", stringifyMercadoPagoErrorDiagnostic(mpErrorDiagnostic));
    return bad(
      safeDetail
        ? `Mercado Pago rechazó la solicitud: ${safeDetail}`
        : "Mercado Pago rechazó la solicitud. Revisá los datos e intentá nuevamente.",
      502
    );
  }

  const confirmation = await prisma.$transaction((tx) =>
    tx.payment.update({
      where: { id: preparedAttempt.paymentRowId },
      data: {
        mpOrderId: typeof mpData.id === "string" ? mpData.id : undefined,
        mpRequestStatus: MP_ORDER_REQUEST_STATUSES.completed,
        mpRequestFinishedAt: new Date(),
        mpLastError: null,
      },
    }).then(() =>
      reconcileMercadoPagoFinancialConfirmation(
        tx,
        {
          flow: "checkout_api_order",
          order: mpData,
          expectedConnectedUserId: connectedUserId,
        },
        {
          fallbackOrderId: order.id,
          fallbackPaymentRowId: preparedAttempt.paymentRowId,
        },
      )
    )
  );

  if (!confirmation.ok) {
    console.error("Mercado Pago Orders evidence rejected", {
      orderId: order.id,
      reason: confirmation.reason,
      status: confirmation.status,
      paymentId: confirmation.paymentId,
    });
    return bad("Mercado Pago respondió, pero la evidencia financiera no coincide con el pedido.", 502);
  }

  if (confirmation.status === "approved") {
    await syncMetaPurchaseForOrder(order.id, { req });
  }

  return NextResponse.json({
    ok: true,
    status: confirmation.status,
    statusDetail,
    paymentId: confirmation.paymentId || paymentId,
    message: paymentMessage(confirmation.status, statusDetail || undefined),
    orderUrl: buildPublicOrderUrl(site, order),
  });
}
