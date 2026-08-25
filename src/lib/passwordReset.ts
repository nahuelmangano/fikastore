import bcrypt from "bcrypt";
import crypto from "crypto";
import { getCustomDomainOrigin } from "@/lib/customDomain";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { isPrivateOrLocalHost, publicBaseUrl } from "@/lib/publicUrl";
import { DEFAULT_SITE_TITLE } from "@/lib/storeSettings";

const RESET_TOKEN_TTL_HOURS = 2;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function resetEmailHtml(input: { customerName: string; resetUrl: string; storeName: string }) {
  const customerName = escapeHtml(input.customerName);
  const resetUrl = escapeHtml(input.resetUrl);
  const storeName = escapeHtml(input.storeName);

  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111;background:#fff;">
      <div style="padding:28px 24px 20px;">
        <div style="font-size:13px;color:#777;margin-bottom:18px;">${storeName}</div>
        <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:#111;">Restablecé tu contraseña</h1>
        <p style="margin:0 0 18px;color:#444;">Hola ${customerName}, recibimos una solicitud para cambiar la contraseña de tu cuenta.</p>
        <p style="margin:0 0 18px;color:#444;">Este enlace vence en ${RESET_TOKEN_TTL_HOURS} horas y solo puede usarse una vez.</p>
        <p style="margin:18px 0 0;">
          <a href="${resetUrl}" style="display:inline-block;background:#111;color:#fff;padding:11px 16px;border-radius:8px;text-decoration:none;font-weight:700;">Cambiar contraseña</a>
        </p>
        <p style="margin:18px 0 0;color:#555;">Si no pediste este cambio, podés ignorar este mail.</p>
      </div>
    </div>
  `;
}

function resetEmailText(input: { customerName: string; resetUrl: string; storeName: string }) {
  return [
    `${input.storeName}`,
    "",
    `Hola ${input.customerName}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`,
    `Este enlace vence en ${RESET_TOKEN_TTL_HOURS} horas y solo puede usarse una vez.`,
    "",
    `Cambiar contraseña: ${input.resetUrl}`,
    "",
    "Si no pediste este cambio, podés ignorar este mail.",
  ].join("\n");
}

async function passwordResetBaseUrl(req: Request) {
  const fallback = publicBaseUrl(req);

  try {
    const parsed = new URL(fallback);
    if (!isPrivateOrLocalHost(parsed.hostname)) {
      return fallback;
    }
  } catch {}

  return (await getCustomDomainOrigin()) || fallback;
}

export async function requestPasswordReset(req: Request, emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (!email) return;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.deleteMany({
    where: {
      OR: [
        { userId: user.id },
        { expiresAt: { lt: new Date() } },
      ],
    },
  });

  await prisma.passwordResetToken.create({
    data: {
      tokenHash,
      userId: user.id,
      expiresAt,
    },
  });

  const baseUrl = await passwordResetBaseUrl(req);
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;
  const storeName = DEFAULT_SITE_TITLE;
  const customerName = user.name?.trim() || user.email;

  await sendMail({
    to: user.email,
    subject: `${storeName} · Restablecer contraseña`,
    html: resetEmailHtml({ customerName, resetUrl, storeName }),
    text: resetEmailText({ customerName, resetUrl, storeName }),
  });
}

export async function validatePasswordResetToken(rawToken: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, usedAt: true, expiresAt: true },
  });

  if (!record) return { ok: false as const, error: "El enlace no es válido." };
  if (record.usedAt) return { ok: false as const, error: "Este enlace ya fue utilizado." };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false as const, error: "Este enlace ya venció." };
  return { ok: true as const };
}

export async function consumePasswordResetToken(rawToken: string, newPassword: string) {
  const tokenHash = hashToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });

  if (!record) {
    return { ok: false as const, error: "El enlace no es válido." };
  }
  if (record.usedAt) {
    return { ok: false as const, error: "Este enlace ya fue utilizado." };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "Este enlace ya venció." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
      },
    }),
  ]);

  return { ok: true as const };
}
