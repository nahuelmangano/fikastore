import { NextResponse } from "next/server";
import { processScheduledEmailJobs } from "@/lib/emailNotificationJobs";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || 25)));
  const started = Date.now();
  const result = await processScheduledEmailJobs(req, limit);

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
    ...result,
  });
}
