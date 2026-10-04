import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/roles";
import { getScreenTextSettings, setScreenTextSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdminRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true, settings: await getScreenTextSettings() });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdminRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const settings = await setScreenTextSettings(body);
  return NextResponse.json({ ok: true, settings });
}
