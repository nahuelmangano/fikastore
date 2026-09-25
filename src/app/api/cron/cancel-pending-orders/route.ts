import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelScheduledEmailJobs } from "@/lib/emailNotificationService";
import { cancelPendingOrderInTransaction } from "@/lib/orderCancellation";
import { notifyBackInStock } from "@/lib/stockNotifications";

export const runtime = "nodejs";

const DEFAULT_AUTO_CANCEL_HOURS = 48;
const BATCH_SIZE = 50;

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("x-cron-secret") === secret || req.headers.get("authorization") === `Bearer ${secret}`;
}

function autoCancelHours() {
  const value = Number(process.env.PENDING_ORDER_AUTO_CANCEL_HOURS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_AUTO_CANCEL_HOURS;
}

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const hours = autoCancelHours();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const candidates = await prisma.order.findMany({
    where: {
      status: "pending_payment",
      createdAt: { lte: cutoff },
      payments: {
        some: { status: { in: ["pending", "unknown"] } },
        none: { status: "approved" },
      },
    },
    select: { id: true, orderNumber: true },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  let cancelled = 0;
  const skipped: Array<{ orderId: string; orderNumber: number; reason: string }> = [];
  const restoredProductIds = new Set<string>();
  const cancelledPaymentIds = new Set<string>();

  for (const candidate of candidates) {
    const result = await prisma.$transaction((tx) => cancelPendingOrderInTransaction(tx, candidate.id));

    if (!result.ok) {
      skipped.push({ orderId: candidate.id, orderNumber: candidate.orderNumber, reason: result.reason });
      continue;
    }

    cancelled += 1;
    result.restoredProductIds.forEach((productId) => restoredProductIds.add(productId));
    result.paymentIds.forEach((paymentId) => cancelledPaymentIds.add(paymentId));

    await cancelScheduledEmailJobs({ orderId: candidate.id });
    await Promise.all(result.paymentIds.map((paymentId) => cancelScheduledEmailJobs({ paymentId })));
  }

  await Promise.all(Array.from(restoredProductIds).map((productId) => notifyBackInStock(productId, req)));

  return NextResponse.json({
    ok: true,
    hours,
    cutoff: cutoff.toISOString(),
    checked: candidates.length,
    cancelled,
    cancelledPayments: cancelledPaymentIds.size,
    skipped,
  });
}

export async function POST(req: Request) {
  return handler(req);
}

export async function GET(req: Request) {
  return handler(req);
}
