import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const PROVIDER = "mercadopago";
const ACCESS_TOKEN_KEY = "oauth_access_token";
const REFRESH_TOKEN_KEY = "oauth_refresh_token";
const EXPIRES_AT_KEY = "oauth_expires_at";
const USER_ID_KEY = "oauth_user_id";
const PUBLIC_KEY_KEY = "oauth_public_key";
const LIVE_MODE_KEY = "oauth_live_mode";
const SCOPE_KEY = "oauth_scope";
const STATE_KEY = "oauth_state";
const STATE_EXPIRES_AT_KEY = "oauth_state_expires_at";
const PKCE_VERIFIER_KEY = "oauth_pkce_verifier";

const TOKEN_URL = "https://api.mercadopago.com/oauth/token";
const AUTHORIZATION_URL = "https://auth.mercadopago.com/authorization";
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60;

type SettingRow = {
  key: string;
  value: string;
};

type MercadoPagoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number | string;
  public_key?: string;
  live_mode?: boolean;
  scope?: string;
  error?: string;
  message?: string;
};

export type MercadoPagoConnectionStatus = {
  connected: boolean;
  fallbackEnvToken: boolean;
  userId: string | null;
  expiresAt: string | null;
  liveMode: boolean | null;
  scope: string | null;
  clientConfigured: boolean;
  redirectUri: string | null;
};

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} no configurado.`);
  return value;
}

function getClientConfig() {
  return {
    clientId: getRequiredEnv("MP_CLIENT_ID"),
    clientSecret: getRequiredEnv("MP_CLIENT_SECRET"),
  };
}

export function getMercadoPagoRedirectUri(baseUrl: string) {
  return (
    process.env.MP_OAUTH_REDIRECT_URI?.trim() ||
    `${baseUrl.replace(/\/$/, "")}/api/admin/mercadopago/oauth/callback`
  );
}

function settingValue(rows: SettingRow[], key: string) {
  return rows.find((row) => row.key === key)?.value?.trim() || "";
}

async function getSettings(keys: string[]) {
  return prisma.shippingProviderSetting.findMany({
    where: { provider: PROVIDER, key: { in: keys } },
    select: { key: true, value: true },
  });
}

async function setSecret(key: string, value: string, isSecret = true) {
  return prisma.shippingProviderSetting.upsert({
    where: { provider_key: { provider: PROVIDER, key } },
    create: { provider: PROVIDER, key, value, isSecret },
    update: { value, isSecret },
  });
}

async function deleteSettings(keys: string[]) {
  return prisma.shippingProviderSetting.deleteMany({
    where: { provider: PROVIDER, key: { in: keys } },
  });
}

function base64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function createPkceVerifier() {
  return base64Url(randomBytes(48));
}

function createPkceChallenge(verifier: string) {
  return base64Url(createHash("sha256").update(verifier).digest());
}

function isPkceEnabled() {
  return process.env.MP_OAUTH_USE_PKCE === "1" || process.env.MP_OAUTH_USE_PKCE === "true";
}

async function saveTokenResponse(data: MercadoPagoTokenResponse) {
  if (!data.access_token || !data.refresh_token) {
    throw new Error(`Respuesta OAuth invalida: ${JSON.stringify(data)}`);
  }

  const expiresIn = Number(data.expires_in || DEFAULT_TOKEN_TTL_SECONDS);
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

  await Promise.all([
    setSecret(ACCESS_TOKEN_KEY, data.access_token),
    setSecret(REFRESH_TOKEN_KEY, data.refresh_token),
    setSecret(EXPIRES_AT_KEY, expiresAt, false),
    setSecret(USER_ID_KEY, data.user_id ? String(data.user_id) : "", false),
    setSecret(PUBLIC_KEY_KEY, data.public_key || "", true),
    setSecret(LIVE_MODE_KEY, typeof data.live_mode === "boolean" ? String(data.live_mode) : "", false),
    setSecret(SCOPE_KEY, data.scope || "", false),
  ]);
}

async function postToken(params: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = (await res.json().catch(() => ({}))) as MercadoPagoTokenResponse;
  if (!res.ok) {
    throw new Error(data.message || data.error || `Mercado Pago OAuth error ${res.status}`);
  }

  return data;
}

export async function createMercadoPagoAuthorizationUrl(baseUrl: string) {
  const { clientId } = getClientConfig();
  const redirectUri = getMercadoPagoRedirectUri(baseUrl);
  const state = base64Url(randomBytes(32));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await Promise.all([
    setSecret(STATE_KEY, state, true),
    setSecret(STATE_EXPIRES_AT_KEY, expiresAt, false),
  ]);

  const url = new URL(AUTHORIZATION_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", redirectUri);

  if (isPkceEnabled()) {
    const verifier = createPkceVerifier();
    const challenge = createPkceChallenge(verifier);
    await setSecret(PKCE_VERIFIER_KEY, verifier, true);
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
  } else {
    await deleteSettings([PKCE_VERIFIER_KEY]);
  }

  return url.toString();
}

export async function exchangeMercadoPagoAuthorizationCode(code: string, state: string, baseUrl: string) {
  const rows = await getSettings([STATE_KEY, STATE_EXPIRES_AT_KEY, PKCE_VERIFIER_KEY]);
  const expectedState = settingValue(rows, STATE_KEY);
  const stateExpiresAt = Date.parse(settingValue(rows, STATE_EXPIRES_AT_KEY));
  const verifier = settingValue(rows, PKCE_VERIFIER_KEY);

  if (!expectedState || expectedState !== state) throw new Error("State OAuth invalido.");
  if (!Number.isFinite(stateExpiresAt) || stateExpiresAt < Date.now()) throw new Error("State OAuth vencido.");

  const { clientId, clientSecret } = getClientConfig();
  const params: Record<string, string> = {
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: getMercadoPagoRedirectUri(baseUrl),
  };

  if (verifier) params.code_verifier = verifier;

  const data = await postToken(params);

  await saveTokenResponse(data);
  await deleteSettings([STATE_KEY, STATE_EXPIRES_AT_KEY, PKCE_VERIFIER_KEY]);
}

async function refreshMercadoPagoAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = getClientConfig();
  const data = await postToken({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  await saveTokenResponse(data);
  return data.access_token || "";
}

export async function getMercadoPagoAccessToken() {
  const rows = await getSettings([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRES_AT_KEY]);
  const accessToken = settingValue(rows, ACCESS_TOKEN_KEY);
  const refreshToken = settingValue(rows, REFRESH_TOKEN_KEY);
  const expiresAt = Date.parse(settingValue(rows, EXPIRES_AT_KEY));

  if (accessToken && refreshToken) {
    if (!Number.isFinite(expiresAt) || expiresAt - Date.now() > REFRESH_WINDOW_MS) {
      return accessToken;
    }

    try {
      return await refreshMercadoPagoAccessToken(refreshToken);
    } catch (error) {
      console.error("MP OAuth refresh error", error);
      return accessToken;
    }
  }

  const fallback = process.env.MP_ACCESS_TOKEN?.trim();
  if (fallback) return fallback;

  throw new Error("Mercado Pago OAuth no conectado.");
}

export async function getMercadoPagoConnectionStatus(baseUrl?: string): Promise<MercadoPagoConnectionStatus> {
  const rows = await getSettings([ACCESS_TOKEN_KEY, EXPIRES_AT_KEY, USER_ID_KEY, LIVE_MODE_KEY, SCOPE_KEY]);
  const accessToken = settingValue(rows, ACCESS_TOKEN_KEY);
  const expiresAt = settingValue(rows, EXPIRES_AT_KEY);
  const liveMode = settingValue(rows, LIVE_MODE_KEY);

  return {
    connected: Boolean(accessToken),
    fallbackEnvToken: Boolean(process.env.MP_ACCESS_TOKEN?.trim()),
    userId: settingValue(rows, USER_ID_KEY) || null,
    expiresAt: expiresAt || null,
    liveMode: liveMode ? liveMode === "true" : null,
    scope: settingValue(rows, SCOPE_KEY) || null,
    clientConfigured: Boolean(process.env.MP_CLIENT_ID?.trim() && process.env.MP_CLIENT_SECRET?.trim()),
    redirectUri: baseUrl ? getMercadoPagoRedirectUri(baseUrl) : process.env.MP_OAUTH_REDIRECT_URI?.trim() || null,
  };
}

export async function disconnectMercadoPagoOAuth() {
  await deleteSettings([
    ACCESS_TOKEN_KEY,
    REFRESH_TOKEN_KEY,
    EXPIRES_AT_KEY,
    USER_ID_KEY,
    PUBLIC_KEY_KEY,
    LIVE_MODE_KEY,
    SCOPE_KEY,
    STATE_KEY,
    STATE_EXPIRES_AT_KEY,
    PKCE_VERIFIER_KEY,
  ]);
}
