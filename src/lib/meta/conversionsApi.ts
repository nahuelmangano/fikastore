import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { buildPublicOrderUrl, getOrderContactEmail } from "@/lib/orderAccess";
import { ORDER_PAID_STATUSES } from "@/lib/orderPaymentTransition";
import { prisma } from "@/lib/prisma";
import { publicBaseUrl } from "@/lib/publicUrl";
import { buildMetaPurchaseEventId, buildMetaPurchasePayload } from "@/lib/meta/purchase";

const META_GRAPH_API_VERSION = "v25.0";
const META_LOCK_TTL_MS = 5 * 60 * 1000;
const META_REQUEST_TIMEOUT_MS = 8_000;

type SyncMetaPurchaseOptions = {
  req?: Request;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanString(value: string | null | undefined) {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ");
}

function normalizeForHash(value: string | null | undefined) {
  return cleanString(value).toLowerCase();
}

function normalizePhone(value: string | null | undefined) {
  const digits = cleanString(value).replace(/[^\d]/g, "");
  return digits || "";
}

function normalizePostalCode(value: string | null | undefined) {
  return cleanString(value).replace(/\s+/g, "").toLowerCase();
}

function firstName(value: string | null | undefined) {
  return cleanString(value).split(" ").filter(Boolean)[0] || "";
}

function lastName(value: string | null | undefined) {
  const parts = cleanString(value).split(" ").filter(Boolean);
  if (parts.length < 2) return "";
  return parts.slice(1).join(" ");
}

function withHashedField(target: Record<string, string>, key: string, value: string) {
  if (!value) return;
  target[key] = sha256(value);
}

function metaConfig() {
  return {
    pixelId: String(process.env.META_PIXEL_ID || "").trim(),
    accessToken: String(process.env.META_CAPI_ACCESS_TOKEN || "").trim(),
    testEventCode: String(process.env.META_CAPI_TEST_EVENT_CODE || "").trim(),
  };
}

function buildUserData(order: {
  contactEmail: string | null;
  shippingPhone: string;
  shippingName: string;
  shippingCity: string;
  shippingProvince: string;
  shippingProvinceCode: string;
  shippingZip: string;
  metaClientIpAddress: string | null;
  metaClientUserAgent: string | null;
  metaFbp: string | null;
  metaFbc: string | null;
  user: { email: string | null; name: string | null } | null;
}) {
  const userData: Record<string, string> = {};
  const email = normalizeForHash(getOrderContactEmail(order));
  const phone = normalizePhone(order.shippingPhone);
  const nameSource = cleanString(order.shippingName || order.user?.name || "");
  const city = normalizeForHash(order.shippingCity);
  const state = normalizeForHash(order.shippingProvinceCode || order.shippingProvince);
  const postalCode = normalizePostalCode(order.shippingZip);

  withHashedField(userData, "em", email);
  withHashedField(userData, "ph", phone);
  withHashedField(userData, "fn", normalizeForHash(firstName(nameSource)));
  withHashedField(userData, "ln", normalizeForHash(lastName(nameSource)));
  withHashedField(userData, "ct", city);
  withHashedField(userData, "st", state);
  withHashedField(userData, "zp", postalCode);

  if (order.metaClientIpAddress) userData.client_ip_address = order.metaClientIpAddress;
  if (order.metaClientUserAgent) userData.client_user_agent = order.metaClientUserAgent;
  if (order.metaFbp) userData.fbp = order.metaFbp;
  if (order.metaFbc) userData.fbc = order.metaFbc;

  return userData;
}

async function sendPurchaseEvent(input: {
  order: {
    id: string;
    orderNumber: number;
    total: unknown;
    paidAt: Date | null;
    updatedAt: Date;
    contactEmail: string | null;
    shippingPhone: string;
    shippingName: string;
    shippingCity: string;
    shippingProvince: string;
    shippingProvinceCode: string;
    shippingZip: string;
    metaClientIpAddress: string | null;
    metaClientUserAgent: string | null;
    metaFbp: string | null;
    metaFbc: string | null;
    user: { email: string | null; name: string | null } | null;
    items: Array<{
      productId: string;
      quantity: number;
      unitPrice: unknown;
    }>;
  };
  req?: Request;
}) {
  const { pixelId, accessToken, testEventCode } = metaConfig();

  if (!pixelId || !accessToken) {
    throw new Error("Meta CAPI missing configuration");
  }

  const baseUrl = publicBaseUrl(input.req);
  const eventTimeSource = input.order.paidAt || input.order.updatedAt || new Date();
  const customData = buildMetaPurchasePayload({
    id: input.order.id,
    total: Number(input.order.total),
    items: input.order.items.map((item) => ({
      id: item.productId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
    })),
  });

  const event = {
    event_name: "Purchase",
    event_time: Math.floor(eventTimeSource.getTime() / 1000),
    action_source: "website",
    event_source_url: buildPublicOrderUrl(baseUrl, input.order),
    event_id: buildMetaPurchaseEventId(input.order.id),
    user_data: buildUserData(input.order),
    custom_data: customData,
  };

  const payload = {
    data: [event],
    ...(testEventCode ? { test_event_code: testEventCode } : {}),
  };

  const endpoint = `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`;

  console.info(`[Meta CAPI] Sending Purchase order=${input.order.id} orderNumber=${input.order.orderNumber}`);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(META_REQUEST_TIMEOUT_MS),
  });
  const responseJson = await response.json().catch(() => null);

  if (!response.ok) {
    const graphMessage =
      typeof responseJson?.error?.message === "string" ? responseJson.error.message : "HTTP error";
    throw new Error(`status=${response.status} graph=${graphMessage}`);
  }

  if (responseJson?.error) {
    const graphMessage =
      typeof responseJson.error.message === "string" ? responseJson.error.message : "Graph API error";
    throw new Error(`status=${response.status} graph=${graphMessage}`);
  }

  if (typeof responseJson?.events_received === "number" && responseJson.events_received < 1) {
    throw new Error(`status=${response.status} graph=events_received:${responseJson.events_received}`);
  }

  return responseJson;
}

export async function syncMetaPurchaseForOrder(orderId: string, options: SyncMetaPurchaseOptions = {}) {
  const now = new Date();
  const lockExpiresBefore = new Date(now.getTime() - META_LOCK_TTL_MS);
  const lockId = randomUUID();

  const current = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      metaPurchaseSentAt: true,
      metaPurchaseLockedAt: true,
    },
  });

  if (!current || !ORDER_PAID_STATUSES.has(current.status)) {
    return { ok: false, skipped: "not_paid" as const };
  }

  if (current.metaPurchaseSentAt) {
    console.info(`[Meta CAPI] Purchase already sent order=${orderId}`);
    return { ok: true, skipped: "already_sent" as const };
  }

  const acquired = await prisma.order.updateMany({
    where: {
      id: orderId,
      metaPurchaseSentAt: null,
      OR: [
        { metaPurchaseLockedAt: null },
        { metaPurchaseLockedAt: { lt: lockExpiresBefore } },
      ],
    },
    data: {
      metaPurchaseLockId: lockId,
      metaPurchaseLockedAt: now,
    },
  });

  if (acquired.count !== 1) {
    return { ok: false, skipped: "locked" as const };
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, metaPurchaseLockId: lockId },
      select: {
        id: true,
        status: true,
        orderNumber: true,
        total: true,
        paidAt: true,
        updatedAt: true,
        contactEmail: true,
        shippingPhone: true,
        shippingName: true,
        shippingCity: true,
        shippingProvince: true,
        shippingProvinceCode: true,
        shippingZip: true,
        metaClientIpAddress: true,
        metaClientUserAgent: true,
        metaFbp: true,
        metaFbc: true,
        user: { select: { email: true, name: true } },
        items: {
          select: {
            productId: true,
            quantity: true,
            unitPrice: true,
          },
        },
      },
    });

    if (!order || !ORDER_PAID_STATUSES.has(order.status)) {
      throw new Error("Order unavailable for Meta sync");
    }

    await sendPurchaseEvent({ order, req: options.req });

    await prisma.order.updateMany({
      where: {
        id: orderId,
        metaPurchaseLockId: lockId,
        metaPurchaseSentAt: null,
      },
      data: {
        metaPurchaseSentAt: new Date(),
        metaPurchaseLockId: null,
        metaPurchaseLockedAt: null,
      },
    });

    console.info(`[Meta CAPI] Purchase sent order=${orderId}`);
    return { ok: true, skipped: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[Meta CAPI] Purchase failed order=${orderId} ${message}`);
    await prisma.order.updateMany({
      where: { id: orderId, metaPurchaseLockId: lockId },
      data: {
        metaPurchaseLockId: null,
        metaPurchaseLockedAt: null,
      },
    });
    return { ok: false, skipped: "failed" as const };
  }
}
