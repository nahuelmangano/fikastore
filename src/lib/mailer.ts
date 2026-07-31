import nodemailer from "nodemailer";
import { getResolvedSmtpConfig, type ResolvedSmtpConfig } from "@/lib/storeSettings";

export async function getTransport(config?: ResolvedSmtpConfig) {
  const smtpConfig = config || (await getResolvedSmtpConfig());
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: smtpConfig.user, pass: smtpConfig.pass },
  });
}

export async function sendMail(opts: { to: string; subject: string; html: string }) {
  const config = await getResolvedSmtpConfig();
  const transport = await getTransport(config);

  await transport.sendMail({
    from: config.from || "no-reply@fikastore",
    replyTo: config.replyTo,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
