function extractEmail(value?: string | null) {
  const raw = String(value || "").trim();
  const match = raw.match(/([^\s<>,;]+@[^\s<>,;]+)/);
  return match?.[1] ?? "";
}

export function resolveNotificationEmail(input: {
  smtpReplyTo?: string | null;
  smtpFrom?: string | null;
  smtpUser?: string | null;
  customNotifyEmail?: string | null;
}) {
  const candidates = [
    input.smtpUser,
    input.smtpFrom,
    input.smtpReplyTo,
    input.customNotifyEmail,
    process.env.SUPPORT_EMAIL,
    process.env.SMTP_FROM,
  ];

  for (const candidate of candidates) {
    const email = extractEmail(candidate);
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return email;
  }

  return "";
}
