import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { disconnectMercadoPagoOAuth, getMercadoPagoConnectionStatus } from "@/lib/mercadopago";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

function baseUrl(req: Request) {
  const envUrl =
    process.env.APP_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) return envUrl.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";

  return host ? `${proto}://${host}`.replace(/\/$/, "") : "http://localhost:3000";
}

async function requireStaff() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return isStaffRole(role);
}

export async function GET(req: Request) {
  if (!(await requireStaff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const status = await getMercadoPagoConnectionStatus(baseUrl(req));
  return NextResponse.json({ ok: true, status });
}

export async function DELETE() {
  if (!(await requireStaff())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  await disconnectMercadoPagoOAuth();
  return NextResponse.json({ ok: true });
}
