import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canEncryptMailingSecrets,
  getMailingSettings,
  setMailingSettings,
  setMailingSmtpSettings,
} from "@/lib/storeSettings";
import { orderPaidTemplate, stockBackInStockTemplate } from "@/lib/email-templates";
import { sendMail } from "@/lib/mailer";
import { publicBaseUrl } from "@/lib/publicUrl";
import { isAdminRole, isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

const MAX_SUBJECT_LENGTH = 140;
const MAX_MESSAGE_LENGTH = 1200;
const MAX_SMTP_FIELD_LENGTH = 255;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function renderBackInStockSubject(template: string, productName: string) {
  return template.replaceAll("{{productName}}", productName).trim();
}

async function buildMailPreview(input: {
  template: string;
  subject?: string;
  message?: string;
  req: Request;
}) {
  const mailing = await getMailingSettings();
  const subject = String(input.subject || "").trim();
  const message = String(input.message || "").trim();

  if (input.template === "purchase") {
    const testSubject = subject || mailing.purchaseSubject;
    const testMessage = message || mailing.purchaseMessage;

    if (!testSubject || !testMessage) {
      throw new Error("Completa el asunto y mensaje de compra para previsualizar el envio.");
    }

    return {
      subject: testSubject,
      html: orderPaidTemplate({
        customerName: "Cliente de prueba",
        orderId: "test-order",
        orderNumber: 1001,
        orderDate: new Date(),
        payment: {
          provider: "Mercado Pago",
          status: "approved",
          method: "visa",
          paymentId: "123456789",
          installments: 1,
          amount: 24900,
        },
        shipping: {
          method: "correo",
          deliveryType: "D",
          addressLine: "Av. Corrientes 1234",
          city: "CABA",
          province: "Buenos Aires",
          zip: "1043",
          amount: 0,
        },
        billingAddress: {
          name: "Cliente de prueba",
          addressLine: "Av. Corrientes 1234",
          city: "CABA",
          province: "Buenos Aires",
          zip: "1043",
        },
        subtotal: 24900,
        discount: 0,
        total: 24900,
        items: [
          { name: "Producto de prueba", variantName: "Talle M", qty: 1, unit: 14900, subtotal: 14900, imageUrl: `${publicBaseUrl(input.req)}/fika-logo.svg` },
          { name: "Variante de ejemplo", variantName: "Talle L", qty: 2, unit: 5000, subtotal: 10000, imageUrl: `${publicBaseUrl(input.req)}/fika-logo.svg` },
        ],
        message: testMessage,
      }),
    };
  }

  if (input.template === "backInStock") {
    const productName = "Producto de prueba";
    const testSubject = renderBackInStockSubject(subject || mailing.backInStockSubject, productName);
    const testMessage = message || mailing.backInStockMessage;

    if (!testSubject || !testMessage) {
      throw new Error("Completa el asunto y mensaje de vuelta de stock para previsualizar el envio.");
    }

    return {
      subject: testSubject,
      html: stockBackInStockTemplate({
        customerName: "Cliente de prueba",
        productName,
        productUrl: `${publicBaseUrl(input.req)}/products/producto-de-prueba`,
        imageUrl: `${publicBaseUrl(input.req)}/fika-logo.svg`,
        message: testMessage,
      }),
    };
  }

  return {
    subject: "FikaStore · Prueba de mailing",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <h2 style="margin:0 0 10px;">Prueba de mailing</h2>
        <p style="margin:0;color:#444;">La configuracion SMTP esta funcionando correctamente.</p>
      </div>
    `,
  };
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const settings = await getMailingSettings();
  return NextResponse.json({
    ok: true,
    settings,
    canSaveSmtpSecrets: isAdminRole(role) && canEncryptMailingSecrets(),
    canManageSmtp: isAdminRole(role),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const canManageSmtp = isAdminRole(role);

  const body = await req.json().catch(() => ({}));
  const settings = {
    purchaseEnabled: body.purchaseEnabled !== false,
    purchaseSubject: String(body.purchaseSubject || "").trim(),
    purchaseMessage: String(body.purchaseMessage || "").trim(),
    backInStockEnabled: body.backInStockEnabled !== false,
    backInStockSubject: String(body.backInStockSubject || "").trim(),
    backInStockMessage: String(body.backInStockMessage || "").trim(),
    smtpHost: String(body.smtpHost || "").trim(),
    smtpPort: String(body.smtpPort || "").trim() || "587",
    smtpUser: String(body.smtpUser || "").trim(),
    smtpFrom: String(body.smtpFrom || "").trim(),
    smtpReplyTo: String(body.smtpReplyTo || "").trim(),
    smtpPassConfigured: Boolean(body.smtpPassConfigured),
    smtpSource: "none" as const,
  };
  const smtpPass = String(body.smtpPass || "").trim();

  if (!settings.purchaseSubject || !settings.purchaseMessage || !settings.backInStockSubject || !settings.backInStockMessage) {
    return NextResponse.json({ ok: false, error: "Todos los campos son requeridos." }, { status: 400 });
  }

  if (settings.purchaseSubject.length > MAX_SUBJECT_LENGTH || settings.backInStockSubject.length > MAX_SUBJECT_LENGTH) {
    return NextResponse.json({ ok: false, error: `Los asuntos no pueden superar ${MAX_SUBJECT_LENGTH} caracteres.` }, { status: 400 });
  }

  if (settings.purchaseMessage.length > MAX_MESSAGE_LENGTH || settings.backInStockMessage.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ ok: false, error: `Los mensajes no pueden superar ${MAX_MESSAGE_LENGTH} caracteres.` }, { status: 400 });
  }

  if (canManageSmtp && (
    settings.smtpHost.length > MAX_SMTP_FIELD_LENGTH ||
    settings.smtpUser.length > MAX_SMTP_FIELD_LENGTH ||
    settings.smtpFrom.length > MAX_SMTP_FIELD_LENGTH ||
    settings.smtpReplyTo.length > MAX_SMTP_FIELD_LENGTH
  )) {
    return NextResponse.json({ ok: false, error: "Los campos SMTP no pueden superar 255 caracteres." }, { status: 400 });
  }

  const port = Number(settings.smtpPort);
  if (canManageSmtp && (!Number.isInteger(port) || port < 1 || port > 65535)) {
    return NextResponse.json({ ok: false, error: "El puerto SMTP no es valido." }, { status: 400 });
  }

  if (canManageSmtp && settings.smtpFrom && !isValidEmail(settings.smtpFrom)) {
    return NextResponse.json({ ok: false, error: "El email remitente no es valido." }, { status: 400 });
  }

  if (canManageSmtp && settings.smtpReplyTo && !isValidEmail(settings.smtpReplyTo)) {
    return NextResponse.json({ ok: false, error: "El email de respuesta no es valido." }, { status: 400 });
  }

  if (canManageSmtp && smtpPass && !canEncryptMailingSecrets()) {
    return NextResponse.json(
      { ok: false, error: "Falta configurar MAILING_ENCRYPTION_KEY para guardar contrasenas SMTP." },
      { status: 400 }
    );
  }

  await setMailingSettings(settings);
  if (canManageSmtp) {
    await setMailingSmtpSettings({ ...settings, smtpPass });
  }
  return NextResponse.json({ ok: true, settings: await getMailingSettings() });
}

export async function PUT(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const template = String(body.template || "smtp").trim();

  try {
    const preview = await buildMailPreview({
      template,
      subject: String(body.subject || "").trim(),
      message: String(body.message || "").trim(),
      req,
    });
    return NextResponse.json({ ok: true, preview });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo generar la previsualizacion." },
      { status: 400 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { role?: string; email?: string | null } | undefined;
  if (!isAdminRole(user?.role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const to = String(body.to || user?.email || "").trim();
  const template = String(body.template || "smtp").trim();

  if (!to || !isValidEmail(to)) {
    return NextResponse.json({ ok: false, error: "Indica un email valido para la prueba." }, { status: 400 });
  }

  try {
    const preview = await buildMailPreview({
      template,
      subject: String(body.subject || "").trim(),
      message: String(body.message || "").trim(),
      req,
    });
    await sendMail({
      to,
      subject: preview.subject,
      html: preview.html,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo enviar el email de prueba." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
