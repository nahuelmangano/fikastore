import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createMercadoPagoAuthorizationUrl } from "@/lib/mercadopago";
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

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const authorizationUrl = await createMercadoPagoAuthorizationUrl(baseUrl(req));
    return NextResponse.json({ ok: true, authorizationUrl });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo iniciar OAuth." },
      { status: 500 }
    );
  }
}
