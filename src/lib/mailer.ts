import nodemailer from "nodemailer";
import { createHash } from "node:crypto";
import {
  getResolvedSmtpConfig,
  persistRotatedMicrosoftRefreshToken,
  type ResolvedSmtpConfig,
} from "@/lib/storeSettings";

const microsoftRefreshes = new Map<string, Promise<string>>();

async function requestMicrosoftSmtpAccessToken(
  config: Extract<ResolvedSmtpConfig, { authType: "microsoft_oauth2" }>,
  dependencies: {
    request?: typeof fetch;
    persistRefreshToken?: typeof persistRotatedMicrosoftRefreshToken;
  } = {},
) {
  const request = dependencies.request || fetch;
  const persistRefreshToken = dependencies.persistRefreshToken || persistRotatedMicrosoftRefreshToken;
  const res = await request(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
      scope: "https://outlook.office.com/SMTP.Send offline_access",
    }),
  });
  const data = await res.json().catch(() => ({}));
  const accessToken = String(data.access_token || "");

  if (!res.ok || !accessToken) {
    const code = typeof data.error === "string" ? data.error.replace(/[^a-z0-9_.-]/gi, "").slice(0, 80) : "unknown";
    throw new Error(`Microsoft OAuth2 token refresh failed: status=${res.status} code=${code}`);
  }

  const nextRefreshToken = typeof data.refresh_token === "string" ? data.refresh_token : "";
  if (nextRefreshToken && nextRefreshToken !== config.refreshToken) {
    try {
      await persistRefreshToken(config.refreshToken, nextRefreshToken);
    } catch (error) {
      console.error("microsoft smtp oauth refresh token persistence failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }

  return accessToken;
}

export function getMicrosoftSmtpAccessToken(
  config: Extract<ResolvedSmtpConfig, { authType: "microsoft_oauth2" }>,
  dependencies: {
    request?: typeof fetch;
    persistRefreshToken?: typeof persistRotatedMicrosoftRefreshToken;
  } = {},
) {
  const key = createHash("sha256").update(config.refreshToken).digest("hex");
  const pending = microsoftRefreshes.get(key);
  if (pending) return pending;

  const refresh = requestMicrosoftSmtpAccessToken(config, dependencies);
  microsoftRefreshes.set(key, refresh);
  void refresh.finally(() => {
    if (microsoftRefreshes.get(key) === refresh) microsoftRefreshes.delete(key);
  }).catch(() => {});
  return refresh;
}

export async function getTransport(config?: ResolvedSmtpConfig) {
  const smtpConfig = config || (await getResolvedSmtpConfig());
  if (smtpConfig.authType === "microsoft_oauth2") {
    const accessToken = await getMicrosoftSmtpAccessToken(smtpConfig);
    return nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: false,
      auth: {
        type: "OAuth2",
        user: smtpConfig.user,
        accessToken,
      },
    });
  }

  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  });
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  const config = await getResolvedSmtpConfig();
  const transport = await getTransport(config);

  await transport.sendMail({
    from: config.from || "no-reply@fikastore",
    replyTo: config.replyTo,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}
