import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getFaviconUrl, getSiteTitle, setSiteTitle } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const [siteTitle, faviconUrl] = await Promise.all([getSiteTitle(), getFaviconUrl()]);
  return NextResponse.json({ ok: true, siteTitle, faviconUrl });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const siteTitle = String(body.siteTitle || "").trim();

  if (!siteTitle) return NextResponse.json({ ok: false, error: "Titulo requerido" }, { status: 400 });
  if (siteTitle.length > 80) {
    return NextResponse.json({ ok: false, error: "Maximo 80 caracteres" }, { status: 400 });
  }

  await setSiteTitle(siteTitle);
  return NextResponse.json({ ok: true, siteTitle });
}
