import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { publicBaseUrl } from "@/lib/publicUrl";
import { setMercadoPagoOAuthSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";

function redirectToSettings(req: Request, status: string) {
  return NextResponse.redirect(`${publicBaseUrl(req)}/admin/settings?mp_oauth=${status}`);
}

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "merchant") return redirectToSettings(req, "forbidden");

  const url = new URL(req.url);
  const code = String(url.searchParams.get("code") || "").trim();
  const state = String(url.searchParams.get("state") || "").trim();
  const error = String(url.searchParams.get("error") || "").trim();
  const stateCookie = req.cookies.get("mp_oauth_state")?.value;

  if (error) return redirectToSettings(req, "denied");
  if (!code || !state || stateCookie !== state) {
    return redirectToSettings(req, "invalid_state");
  }

  const clientId = String(process.env.MP_OAUTH_CLIENT_ID || process.env.MP_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.MP_OAUTH_CLIENT_SECRET || process.env.MP_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) return redirectToSettings(req, "missing_credentials");

  const site = publicBaseUrl(req);
  const redirectUri = `${site}/api/admin/mercadopago/oauth/callback`;

  const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      test_token: "false",
    }),
  });

  const data = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !data.access_token) {
    console.error("MP OAuth token error", data);
    return redirectToSettings(req, "token_error");
  }

  try {
    await setMercadoPagoOAuthSettings({
      accessToken: String(data.access_token || ""),
      refreshToken: String(data.refresh_token || ""),
      expiresIn: Number(data.expires_in || 0),
      connectedUserId: data.user_id ? String(data.user_id) : undefined,
      tokenType: data.token_type ? String(data.token_type) : undefined,
      scope: data.scope ? String(data.scope) : undefined,
    });
  } catch (error) {
    console.error("MP OAuth save error", error);
    return redirectToSettings(req, "save_error");
  }

  const res = redirectToSettings(req, "connected");
  res.cookies.delete("mp_oauth_state");
  return res;
}
