import crypto from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { publicBaseUrl } from "@/lib/publicUrl";

export const runtime = "nodejs";

function base64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

export async function GET(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "merchant") return NextResponse.redirect(new URL("/admin/settings?mp_oauth=forbidden", req.url));

  const clientId = String(process.env.MP_OAUTH_CLIENT_ID || process.env.MP_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.MP_OAUTH_CLIENT_SECRET || process.env.MP_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/admin/settings?mp_oauth=missing_credentials", req.url));
  }

  const site = publicBaseUrl(req);
  const redirectUri = `${site}/api/admin/mercadopago/oauth/callback`;
  const state = base64Url(crypto.randomBytes(24));

  const authorizationUrl = new URL("https://auth.mercadopago.com/authorization");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("platform_id", "mp");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);

  console.log("MP OAuth authorization URL", {
    clientId,
    redirectUri,
    site,
  });

  const res = NextResponse.redirect(authorizationUrl);
  res.cookies.set("mp_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(site).protocol === "https:",
    path: "/",
    maxAge: 10 * 60,
  });

  return res;
}
