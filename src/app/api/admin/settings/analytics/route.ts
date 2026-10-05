import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import {
  getAnalyticsSettings,
  isValidGoogleAnalyticsMeasurementId,
  isValidMetaPixelId,
  normalizeGoogleAnalyticsMeasurementId,
  normalizeMetaPixelId,
  setAnalyticsSettings,
} from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const settings = await getAnalyticsSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const googleAnalyticsMeasurementId = normalizeGoogleAnalyticsMeasurementId(
    String(body.googleAnalyticsMeasurementId || ""),
  );
  const metaPixelId = normalizeMetaPixelId(String(body.metaPixelId || ""));

  if (googleAnalyticsMeasurementId && !isValidGoogleAnalyticsMeasurementId(googleAnalyticsMeasurementId)) {
    return NextResponse.json(
      { ok: false, error: "Ingresá un Measurement ID válido, por ejemplo G-XXXXXXXXXX." },
      { status: 400 },
    );
  }

  if (metaPixelId && !isValidMetaPixelId(metaPixelId)) {
    return NextResponse.json(
      { ok: false, error: "Ingresá un Meta Pixel ID válido. Debe contener solo números." },
      { status: 400 },
    );
  }

  await setAnalyticsSettings({ googleAnalyticsMeasurementId, metaPixelId });
  return NextResponse.json({ ok: true, settings: { googleAnalyticsMeasurementId, metaPixelId } });
}
