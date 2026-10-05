import nodemailer from "nodemailer";
import { getResolvedSmtpConfig, type ResolvedSmtpConfig } from "@/lib/storeSettings";

async function getMicrosoftSmtpAccessToken(config: Extract<ResolvedSmtpConfig, { authType: "microsoft_oauth2" }>) {
  const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
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
    throw new Error(`Microsoft OAuth2 token refresh failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return accessToken;
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
