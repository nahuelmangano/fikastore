import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getAnnouncementText, setAnnouncementText } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const text = await getAnnouncementText();
  return NextResponse.json({ ok: true, text });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();

  if (!text) return NextResponse.json({ ok: false, error: "Texto requerido" }, { status: 400 });
  if (text.length > 500) {
    return NextResponse.json({ ok: false, error: "Maximo 500 caracteres" }, { status: 400 });
  }

  await setAnnouncementText(text);
  return NextResponse.json({ ok: true, text });
}
