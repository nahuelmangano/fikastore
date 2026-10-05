import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { publicBaseUrl } from "@/lib/publicUrl";
import {
  getMailingMicrosoftOAuthCredentials,
  setMailingSmtpSettings,
} from "@/lib/storeSettings";
import { isAdminRole } from "@/lib/roles";

export const runtime = "nodejs";

const STATE_COOKIE = "mailing_microsoft_oauth_state";

function redirectTo(req: Request, status: string) {
  return NextResponse.redirect(`${publicBaseUrl(req)}/admin/mailing?microsoft=${encodeURIComponent(status)}`);
}

function redirectUri(req: Request) {
  return `${publicBaseUrl(req)}/api/admin/mailing/microsoft/oauth/callback`;
}

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdminRole(role)) return redirectTo(req, "forbidden");

  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) return redirectTo(req, error);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STATE_COOKIE}=`))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectTo(req, "invalid_state");
  }

  const credentials = await getMailingMicrosoftOAuthCredentials();
  if (!credentials?.clientId || !credentials.clientSecret || !credentials.smtpUser) {
    return redirectTo(req, "missing_config");
  }

  const tokenUrl = `https://login.microsoftonline.com/${credentials.tenantId || "common"}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    code,
    redirect_uri: redirectUri(req),
    grant_type: "authorization_code",
    scope: "openid email profile offline_access https://outlook.office.com/SMTP.Send",
  });

  try {
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenData = await tokenRes.json().catch(() => ({}));
    const refreshToken = String(tokenData.refresh_token || "");

    if (!tokenRes.ok || !refreshToken) {
      console.error("microsoft smtp oauth token error", tokenRes.status, tokenData);
      return redirectTo(req, "token_error");
    }

    await setMailingSmtpSettings({
      smtpHost: credentials.smtpHost,
      smtpPort: credentials.smtpPort,
      smtpUser: credentials.smtpUser,
      smtpFrom: credentials.smtpFrom,
      smtpReplyTo: credentials.smtpReplyTo,
      smtpAuthType: "microsoft_oauth2",
      smtpMicrosoftClientId: credentials.clientId,
      smtpMicrosoftTenantId: credentials.tenantId,
      smtpMicrosoftRefreshToken: refreshToken,
    });

    const res = redirectTo(req, "connected");
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch (err) {
    console.error("microsoft smtp oauth callback error", err);
    return redirectTo(req, "token_error");
  }
}
