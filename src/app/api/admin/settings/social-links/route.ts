import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getSocialLinksSettings, setSocialLinksSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const settings = await getSocialLinksSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  await setSocialLinksSettings(body);
  const settings = await getSocialLinksSettings();
  return NextResponse.json({ ok: true, settings });
}
