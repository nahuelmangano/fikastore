import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminRole, isStaffRole } from "@/lib/roles";
import { getMetricsSettings, setMetricsSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const settings = await getMetricsSettings();
  return NextResponse.json({ ok: true, settings, canEdit: isAdminRole(role) });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdminRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  await setMetricsSettings({ startAt: body.startAt });
  return NextResponse.json({ ok: true, settings: await getMetricsSettings() });
}
