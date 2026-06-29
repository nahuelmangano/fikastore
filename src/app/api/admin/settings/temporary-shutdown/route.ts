import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getTemporaryShutdownSettings, setTemporaryShutdownSettings } from "@/lib/storeSettings";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const settings = await getTemporaryShutdownSettings();
  return NextResponse.json({ ok: true, ...settings });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const isShutdown = body.isShutdown === true;
  const message = String(body.message || "").trim().slice(0, 500);

  await setTemporaryShutdownSettings({ isShutdown, message });
  const settings = await getTemporaryShutdownSettings();

  return NextResponse.json({ ok: true, ...settings });
}
