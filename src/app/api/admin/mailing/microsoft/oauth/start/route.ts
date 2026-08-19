import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { publicBaseUrl } from "@/lib/publicUrl";
import { getMailingMicrosoftOAuthCredentials } from "@/lib/storeSettings";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";

const STATE_COOKIE = "mailing_microsoft_oauth_state";
const MICROSOFT_SCOPES = [
  "openid",
  "email",
  "profile",
  "offline_access",
  "https://outlook.office.com/SMTP.Send",
];

function redirectUri(req: Request) {
  return `${publicBaseUrl(req)}/api/admin/mailing/microsoft/oauth/callback`;
}

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdminRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const credentials = await getMailingMicrosoftOAuthCredentials();
  if (!credentials?.clientId || !credentials.clientSecret || !credentials.smtpUser) {
    return NextResponse.redirect(`${publicBaseUrl(req)}/admin/mailing?microsoft=missing_config`);
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const tenantId = credentials.tenantId || "common";
  const authorizeUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
  authorizeUrl.searchParams.set("client_id", credentials.clientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("redirect_uri", redirectUri(req));
  authorizeUrl.searchParams.set("response_mode", "query");
  authorizeUrl.searchParams.set("scope", MICROSOFT_SCOPES.join(" "));
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "consent");
  authorizeUrl.searchParams.set("login_hint", credentials.smtpUser);

  const res = NextResponse.redirect(authorizeUrl);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: publicBaseUrl(req).startsWith("https://"),
    maxAge: 10 * 60,
    path: "/",
  });
  return res;
}
