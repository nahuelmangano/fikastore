import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { sanitizeRichText, stripRichText } from "@/lib/richText";
import { EMAIL_TEMPLATE_DEFAULTS, getDefaultTemplate, type EmailTemplateKey } from "@/lib/emailNotificationTemplates";

type QueueInput = {
  templateKey: EmailTemplateKey;
  to: string;
  recipientUserId?: string | null;
  orderId?: string | null;
  paymentId?: string | null;
  productId?: string | null;
  returnRequestId?: string | null;
  refundId?: string | null;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  isTest?: boolean;
};

type ScheduleInput = {
  type: string;
  runAt: Date;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  orderId?: string | null;
  paymentId?: string | null;
};

type RenderedEmail = { subject: string; html: string; text?: string };

export function sanitizeEmailError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown email error";
  return message
    .replace(/\b(access_token|refresh_token|client_secret|password|authorization)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer [redacted]")
    .slice(0, 1000);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "invalid-email";
  return `${local.slice(0, 2)}***@${domain}`;
}

function renderTemplate(value: string, payload: Record<string, unknown>) {
  return value
    .replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_match, key) => sanitizeRichText(String(payload[key] ?? "")))
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => escapeHtml(String(payload[key] ?? "")));
}

function renderTextTemplate(value: string, payload: Record<string, unknown>) {
  return value.replace(/\{\{\{?\s*([\w.-]+)\s*\}?\}\}/g, (_match, key) => stripRichText(String(payload[key] ?? "")));
}

function durationSince(start: bigint) {
  return Number((process.hrtime.bigint() - start) / BigInt(1_000_000));
}

function workerId() {
  return `${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
}

export async function ensureDefaultEmailTemplates() {
  for (const template of EMAIL_TEMPLATE_DEFAULTS) {
    const existing = await prisma.emailTemplate.findUnique({ where: { key: template.key } });
    if (existing) {
      if (
        (template.key === "cart-abandoned" && !existing.html.includes("cartItemsHtml")) ||
        (template.key === "back-in-stock" && !existing.html.includes("productHtml")) ||
        (template.key === "order-shipped" && (!existing.html.includes("Entregado") || !existing.html.includes("customMessageHtml"))) ||
        (template.key === "birthday-coupon" && (!existing.html.includes("Ir a la tienda") || /Ã|Â/.test(existing.html) || /Ã|Â/.test(existing.text))) ||
        (["payment-rejected", "payment-pending", "payment-pending-reminder"].includes(template.key) && !existing.html.includes("productsHtml")) ||
        (template.key === "payment-pending" && !existing.html.includes("paymentDetailsHtml"))
      ) {
        await prisma.emailTemplate.update({
          where: { key: template.key },
          data: {
            html: template.html,
            text: template.text,
            variablesJson: JSON.stringify(template.variables),
          },
        });
      }
      continue;
    }

    await prisma.emailTemplate.upsert({
      where: { key: template.key },
      create: {
        key: template.key,
        name: template.name,
        category: template.category,
        subject: template.subject,
        html: template.html,
        text: template.text,
        enabled: template.enabled,
        variablesJson: JSON.stringify(template.variables),
      },
      update: {},
    });
  }
}

export async function restoreDefaultEmailTemplate(key: EmailTemplateKey) {
  const template = getDefaultTemplate(key);
  if (!template) throw new Error(`Unknown email template: ${key}`);

  return prisma.emailTemplate.upsert({
    where: { key },
    create: {
      key: template.key,
      name: template.name,
      category: template.category,
      subject: template.subject,
      html: template.html,
      text: template.text,
      enabled: template.enabled,
      variablesJson: JSON.stringify(template.variables),
    },
    update: {
      name: template.name,
      category: template.category,
      subject: template.subject,
      html: template.html,
      text: template.text,
      enabled: template.enabled,
      variablesJson: JSON.stringify(template.variables),
    },
  });
}

export async function getEmailTemplate(key: EmailTemplateKey) {
  await ensureDefaultEmailTemplates();
  const template = await prisma.emailTemplate.findUnique({ where: { key } });
  if (template) return template;
  throw new Error(`Email template not found: ${key}`);
}

export async function renderEmailTemplate(key: EmailTemplateKey, payload: Record<string, unknown>) {
  const template = await getEmailTemplate(key);
  return {
    template,
    subject: renderTextTemplate(template.subject, payload),
    html: renderTemplate(template.html, payload),
    text: renderTextTemplate(template.text, payload),
  };
}

export async function queueEmailNotification(input: QueueInput) {
  await ensureDefaultEmailTemplates();
  return prisma.$transaction((tx) => persistEmailNotificationInTransaction(tx, input));
}

export async function persistEmailNotificationInTransaction(
  tx: Prisma.TransactionClient,
  input: QueueInput,
) {
  let template = await tx.emailTemplate.findUnique({ where: { key: input.templateKey } });
  if (!template) {
    const fallback = getDefaultTemplate(input.templateKey);
    if (!fallback) throw new Error(`Email template not found: ${input.templateKey}`);
    template = await tx.emailTemplate.create({
      data: {
        key: fallback.key,
        name: fallback.name,
        category: fallback.category,
        subject: fallback.subject,
        html: fallback.html,
        text: fallback.text,
        variablesJson: JSON.stringify(fallback.variables),
        enabled: fallback.enabled,
      },
    });
  }
  if (!template) throw new Error(`Email template not found: ${input.templateKey}`);
  const isTest = input.isTest === true;

  if (!template.enabled && !isTest) {
    return tx.emailNotification.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        templateKey: input.templateKey,
        recipientEmail: input.to,
        recipientUserId: input.recipientUserId || null,
        orderId: input.orderId || null,
        paymentId: input.paymentId || null,
        productId: input.productId || null,
        returnRequestId: input.returnRequestId || null,
        refundId: input.refundId || null,
        idempotencyKey: input.idempotencyKey,
        status: "cancelled",
        payloadJson: JSON.stringify(input.payload),
        isTest,
        errorMessage: "Email template disabled",
      },
      update: {},
    });
  }

  return tx.emailNotification.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      templateKey: input.templateKey,
      recipientEmail: input.to,
      recipientUserId: input.recipientUserId || null,
      orderId: input.orderId || null,
      paymentId: input.paymentId || null,
      productId: input.productId || null,
      returnRequestId: input.returnRequestId || null,
      refundId: input.refundId || null,
      idempotencyKey: input.idempotencyKey,
      status: "pending",
      payloadJson: JSON.stringify(input.payload),
      isTest,
    },
    update: {},
  });
}

export async function sendQueuedEmailNotification(notificationId: string) {
  const notification = await prisma.emailNotification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.status === "sent" || notification.status === "cancelled") return notification;

  const start = process.hrtime.bigint();
  const payload = JSON.parse(notification.payloadJson || "{}") as Record<string, unknown>;

  try {
    const storedRendered = payload.__renderedEmail as RenderedEmail | undefined;
    const rendered = storedRendered || await renderEmailTemplate(notification.templateKey as EmailTemplateKey, payload);
    await sendMail({
      to: notification.recipientEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });

    const updated = await prisma.emailNotification.update({
      where: { id: notification.id },
      data: {
        status: "sent",
        sentAt: new Date(),
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
        errorMessage: null,
        lockedAt: null,
        lockedBy: null,
        attempts: {
          create: {
            status: "sent",
            durationMs: durationSince(start),
          },
        },
      },
    });

    console.log("email sent", {
      type: notification.templateKey,
      to: maskEmail(notification.recipientEmail),
      orderId: notification.orderId,
      paymentId: notification.paymentId,
      returnRequestId: notification.returnRequestId,
      refundId: notification.refundId,
      idempotencyKey: notification.idempotencyKey,
      attempts: updated.attemptCount,
      durationMs: durationSince(start),
    });
    return updated;
  } catch (error) {
    const message = sanitizeEmailError(error);
    const updated = await prisma.emailNotification.update({
      where: { id: notification.id },
      data: {
        status: "failed",
        lastAttemptAt: new Date(),
        attemptCount: { increment: 1 },
        errorMessage: message.slice(0, 4000),
        lockedAt: null,
        lockedBy: null,
        attempts: {
          create: {
            status: "failed",
            errorMessage: message.slice(0, 4000),
            durationMs: durationSince(start),
          },
        },
      },
    });

    console.error("email failed", {
      type: notification.templateKey,
      to: maskEmail(notification.recipientEmail),
      orderId: notification.orderId,
      paymentId: notification.paymentId,
      idempotencyKey: notification.idempotencyKey,
      attempts: updated.attemptCount,
      error: message,
      durationMs: durationSince(start),
    });
    return updated;
  }
}

export async function queueAndSendEmailNotification(input: QueueInput) {
  const notification = await queueEmailNotification(input);
  return dispatchQueuedEmailNotification(notification.id);
}

export async function dispatchQueuedEmailNotification(notificationId: string) {
  const lock = workerId();
  const reserved = await prisma.emailNotification.updateMany({
    where: {
      id: notificationId,
      status: { in: ["pending", "failed", "processing"] },
      attemptCount: { lt: 3 },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }],
    },
    data: { status: "processing", lockedAt: new Date(), lockedBy: lock },
  });
  if (reserved.count !== 1) {
    return prisma.emailNotification.findUniqueOrThrow({ where: { id: notificationId } });
  }
  return sendQueuedEmailNotification(notificationId);
}

export async function processPendingEmailNotifications(limit = 25) {
  const lock = workerId();
  const candidates = await prisma.emailNotification.findMany({
    where: {
      status: { in: ["pending", "failed", "processing"] },
      attemptCount: { lt: 3 },
      OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const candidate of candidates) {
    const reserved = await prisma.emailNotification.updateMany({
      where: {
        id: candidate.id,
        status: { in: ["pending", "failed", "processing"] },
        attemptCount: { lt: 3 },
        OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) } }],
      },
      data: { status: "processing", lockedAt: new Date(), lockedBy: lock },
    });
    if (reserved.count !== 1) continue;
    await sendQueuedEmailNotification(candidate.id);
    processed += 1;
  }

  return { processed };
}

export async function scheduleEmailJob(input: ScheduleInput) {
  try {
    return await prisma.scheduledEmailJob.create({
      data: {
        type: input.type,
        runAt: input.runAt,
        idempotencyKey: input.idempotencyKey,
        payloadJson: JSON.stringify(input.payload),
        orderId: input.orderId || null,
        paymentId: input.paymentId || null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return prisma.scheduledEmailJob.findUniqueOrThrow({ where: { idempotencyKey: input.idempotencyKey } });
    }
    throw error;
  }
}

export async function cancelScheduledEmailJobs(where: { orderId?: string; paymentId?: string; type?: string }) {
  return prisma.scheduledEmailJob.updateMany({
    where: {
      status: "pending",
      ...(where.orderId ? { orderId: where.orderId } : {}),
      ...(where.paymentId ? { paymentId: where.paymentId } : {}),
      ...(where.type ? { type: where.type } : {}),
    },
    data: { status: "cancelled" },
  });
}

export async function cancelOrderPaymentEmailJobs(orderId: string, paymentId?: string | null) {
  const types = ["payment-pending-initial", "payment-reminder"];
  const scopes = [{ orderId }, ...(paymentId ? [{ paymentId }] : [])];
  return Promise.all(scopes.flatMap((scope) => types.map((type) => cancelScheduledEmailJobs({ ...scope, type }))));
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createPublicToken() {
  return crypto.randomBytes(32).toString("base64url");
}
