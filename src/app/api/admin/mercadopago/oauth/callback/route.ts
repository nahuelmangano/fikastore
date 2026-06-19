import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { exchangeMercadoPagoAuthorizationCode } from "@/lib/mercadopago";
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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirect = new URL("/admin/settings", baseUrl(req));
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    redirect.searchParams.set("mp_oauth", "error");
    redirect.searchParams.set("message", error);
    return NextResponse.redirect(redirect);
  }

  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    redirect.searchParams.set("mp_oauth", "forbidden");
    return NextResponse.redirect(redirect);
  }

  if (!code || !state) {
    redirect.searchParams.set("mp_oauth", "missing_params");
    return NextResponse.redirect(redirect);
  }

  try {
    await exchangeMercadoPagoAuthorizationCode(code, state, baseUrl(req));
    redirect.searchParams.set("mp_oauth", "connected");
  } catch (err) {
    console.error("MP OAuth callback error", err);
    redirect.searchParams.set("mp_oauth", "error");
    redirect.searchParams.set("message", err instanceof Error ? err.message : "oauth_error");
  }

  return NextResponse.redirect(redirect);
}
