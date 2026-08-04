import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getEmailJobSettings } from "@/lib/storeSettings";
import {
  createPublicToken,
  hashToken,
  processPendingEmailNotifications,
  queueAndSendEmailNotification,
  scheduleEmailJob,
} from "@/lib/emailNotificationService";
import { publicBaseUrl } from "@/lib/publicUrl";
import { emailOrderItemsHtml, emailOrderItemsText } from "@/lib/emailProductRows";

function workerId() {
  return `${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
}

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function birthdayDateForYear(birthDate: Date, year: number) {
  const month = birthDate.getUTCMonth();
  const day = birthDate.getUTCDate();
  if (month === 1 && day === 29 && !isLeapYear(year)) {
    // Criterio documentado: cumpleaños del 29/02 se procesa el 28/02 en años no bisiestos.
    return new Date(Date.UTC(year, 1, 28));
  }
  return new Date(Date.UTC(year, month, day));
}

function makeBirthdayCouponCode(name: string | null | undefined) {
  const normalized = String(name || "CLIENTE")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, "")
    .toUpperCase()
    .slice(0, 10) || "CLIENTE";
  return `CUMPLE-${normalized}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function processPaymentReminder(payload: Record<string, unknown>, req: Request) {
  const paymentId = String(payload.paymentId || "");
  const reminderNumber = Number(payload.reminderNumber || 1);
  if (!paymentId) return { skipped: true };

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          user: true,
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
      },
    },
  });

  if (!payment || payment.status !== "pending" || payment.order.status !== "pending_payment") {
    await prisma.scheduledEmailJob.updateMany({
      where: { paymentId, type: "payment-reminder", status: "pending" },
      data: { status: "cancelled" },
    });
    return { skipped: true };
  }

  const baseUrl = publicBaseUrl(req);
  await queueAndSendEmailNotification({
    templateKey: "payment-pending-reminder",
    to: payment.order.user.email,
    recipientUserId: payment.order.userId,
    orderId: payment.orderId,
    paymentId: payment.id,
    idempotencyKey: `payment-reminder:${payment.id}:${reminderNumber}`,
    payload: {
      customerName: payment.order.user.name || payment.order.user.email,
      orderNumber: payment.order.orderNumber ? `#${payment.order.orderNumber}` : payment.order.id,
      productsHtml: emailOrderItemsHtml(payment.order.items, baseUrl, { total: payment.order.total }),
      productsText: emailOrderItemsText(payment.order.items, { total: payment.order.total }),
      paymentAmount: money(Number(payment.order.total)),
      reminderNumber: String(reminderNumber),
      paymentUrl: `${baseUrl}/pay/pending?orderId=${payment.order.id}`,
      storeName: "FikaStore",
      storeUrl: baseUrl,
    },
  });

  return { sent: true };
}

async function processReviewRequest(payload: Record<string, unknown>, req: Request) {
  const orderId = String(payload.orderId || "");
  if (!orderId) return { skipped: true };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      items: {
        include: {
          product: {
            include: {
              images: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1 },
            },
          },
        },
      },
      refunds: true,
      returnRequests: true,
    },
  });

  if (!order || order.status === "refunded" || order.refunds.some((refund) => refund.status === "processed") || order.returnRequests.some((returnRequest) => returnRequest.status === "COMPLETED")) {
    return { skipped: true };
  }

  const existing = await prisma.emailNotification.findUnique({ where: { idempotencyKey: `review-request:${order.id}` } });
  if (existing?.status === "sent") return { skipped: true };

  const baseUrl = publicBaseUrl(req);
  const productsHtml = (
    await Promise.all(order.items.map(async (item) => {
      const token = createPublicToken();
      await prisma.productReviewToken.upsert({
        where: {
          userId_orderId_productId: {
            userId: order.userId,
            orderId: order.id,
            productId: item.productId,
          },
        },
        create: {
          tokenHash: hashToken(token),
          userId: order.userId,
          orderId: order.id,
          productId: item.productId,
          expiresAt: addDays(new Date(), 30),
        },
        update: {},
      });

      const image = item.product.images[0]?.url;
      const imageUrl = image ? `${baseUrl}${image.startsWith("/") ? image : `/${image}`}` : "";
      return `
        <div style="display:flex;gap:12px;margin:10px 0;">
          ${imageUrl ? `<img src="${imageUrl}" width="64" height="80" style="width:64px;height:80px;object-fit:cover;border:1px solid #eee;border-radius:4px;">` : ""}
          <div>
            <div style="font-weight:700;">${item.nameSnapshot}</div>
            <a href="${baseUrl}/reviews/new?token=${token}" style="color:#111;">Dejar opinión</a>
          </div>
        </div>
      `;
    }))
  ).join("");

  await queueAndSendEmailNotification({
    templateKey: "review-request",
    to: order.user.email,
    recipientUserId: order.userId,
    orderId: order.id,
    idempotencyKey: `review-request:${order.id}`,
    payload: {
      customerName: order.user.name || order.user.email,
      orderNumber: order.orderNumber ? `#${order.orderNumber}` : order.id,
      productsHtml,
      orderUrl: `${baseUrl}/account/orders/${order.id}`,
      storeName: "FikaStore",
      storeUrl: baseUrl,
    },
  });

  return { sent: true };
}

async function processBirthdayCoupons(req: Request) {
  const settings = await getEmailJobSettings();
  if (!settings.birthdayCouponEnabled) return { sent: 0 };

  const now = new Date();
  const year = now.getUTCFullYear();
  const target = addDays(now, -settings.birthdayCouponOffsetDays);
  const users = await prisma.user.findMany({
    where: { birthDate: { not: null }, role: "customer" },
    take: 100,
  });

  let sent = 0;
  const baseUrl = publicBaseUrl(req);

  for (const user of users) {
    if (!user.birthDate) continue;
    const birthday = birthdayDateForYear(user.birthDate, year);
    if (birthday.getUTCMonth() !== target.getUTCMonth() || birthday.getUTCDate() !== target.getUTCDate()) continue;

    const startsAt = addDays(birthday, settings.birthdayCouponOffsetDays);
    const expiresAt = addDays(startsAt, settings.birthdayCouponDurationDays);
    const code = makeBirthdayCouponCode(user.name || user.email);

    const coupon = await prisma.birthdayCoupon.upsert({
      where: { userId_year: { userId: user.id, year } },
      create: {
        userId: user.id,
        year,
        code,
        discountType: settings.birthdayCouponDiscountType,
        discountValue: settings.birthdayCouponDiscountValue,
        minPurchaseAmount: settings.birthdayCouponMinPurchaseAmount,
        maxUses: settings.birthdayCouponMaxUses,
        startsAt,
        expiresAt,
      },
      update: {},
    });

    await queueAndSendEmailNotification({
      templateKey: "birthday-coupon",
      to: user.email,
      recipientUserId: user.id,
      idempotencyKey: `birthday-coupon:${user.id}:${year}`,
      payload: {
        customerName: user.name || user.email,
        couponCode: coupon.code,
        discount: settings.birthdayCouponDiscountType === "percent" ? `${Number(settings.birthdayCouponDiscountValue)}%` : money(Number(settings.birthdayCouponDiscountValue)),
        expiresAt: coupon.expiresAt.toLocaleDateString("es-AR"),
        storeName: "FikaStore",
        storeUrl: baseUrl,
      },
    });
    sent += 1;
  }

  return { sent };
}

export async function scheduleReviewRequestForOrder(orderId: string) {
  const settings = await getEmailJobSettings();
  if (!settings.reviewRequestEnabled) return null;

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { deliveredAt: true } });
  if (!order?.deliveredAt) return null;

  return scheduleEmailJob({
    type: "review-request",
    runAt: addDays(order.deliveredAt, settings.reviewRequestDelayDays),
    idempotencyKey: `review-request:${orderId}`,
    orderId,
    payload: { orderId },
  });
}

export async function processScheduledEmailJobs(req: Request, limit = 25) {
  const lock = workerId();
  const candidates = await prisma.scheduledEmailJob.findMany({
    where: {
      status: "pending",
      runAt: { lte: new Date() },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }],
    },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const candidate of candidates) {
    const reserved = await prisma.scheduledEmailJob.updateMany({
      where: {
        id: candidate.id,
        status: "pending",
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }],
      },
      data: { status: "processing", lockedAt: new Date(), lockedBy: lock, attemptCount: { increment: 1 }, lastAttemptAt: new Date() },
    });
    if (reserved.count !== 1) continue;

    try {
      const payload = JSON.parse(candidate.payloadJson || "{}") as Record<string, unknown>;
      if (candidate.type === "payment-reminder") await processPaymentReminder(payload, req);
      if (candidate.type === "review-request") await processReviewRequest(payload, req);

      await prisma.scheduledEmailJob.update({ where: { id: candidate.id }, data: { status: "completed", lockedAt: null, lockedBy: null, errorMessage: null } });
      processed += 1;
    } catch (error) {
      await prisma.scheduledEmailJob.update({
        where: { id: candidate.id },
        data: {
          status: "failed",
          lockedAt: null,
          lockedBy: null,
          errorMessage: error instanceof Error ? error.message.slice(0, 4000) : "Unknown job error",
        },
      });
    }
  }

  const birthday = await processBirthdayCoupons(req);
  const retries = await processPendingEmailNotifications(limit);
  return { processed, birthday, retries };
}
