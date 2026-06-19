import nodemailer from "nodemailer";

export function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP env missing (SMTP_HOST/SMTP_USER/SMTP_PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user, pass },
  });
}

export async function sendMail(opts: { to: string; subject: string; html: string }) {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "no-reply@fikastore";
  const transport = getTransport();

  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
