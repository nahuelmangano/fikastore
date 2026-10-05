import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  disconnectMailingMicrosoftOAuth,
  getMailingSettings,
} from "@/lib/storeSettings";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function POST() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdminRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  await disconnectMailingMicrosoftOAuth();
  return NextResponse.json({ ok: true, settings: await getMailingSettings() });
}
