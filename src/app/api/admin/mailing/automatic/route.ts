import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole, isStaffRole } from "@/lib/roles";
import { sanitizeRichText, stripRichText } from "@/lib/richText";
import { getEmailJobSettings, setEmailJobSettings } from "@/lib/storeSettings";
import {
  ensureDefaultEmailTemplates,
  processPendingEmailNotifications,
  queueAndSendEmailNotification,
  renderEmailTemplate,
  restoreDefaultEmailTemplate,
} from "@/lib/emailNotificationService";
import { publicBaseUrl } from "@/lib/publicUrl";
import type { EmailTemplateKey } from "@/lib/emailNotificationTemplates";

function samplePayload(req: Request) {
  const baseUrl = publicBaseUrl(req);
  return {
    customerName: "Cliente de prueba",
    orderNumber: "#1001",
    paymentAmount: "$24.900",
    paymentMethod: "Mercado Pago",
    paymentStatus: "rejected",
    rejectionReason: "Fondos insuficientes",
    retryPaymentUrl: `${baseUrl}/pay/pending?orderId=test-order`,
    paymentInstructions: "Completá el pago desde el enlace.",
    paymentDueDate: "No informada",
    paymentUrl: `${baseUrl}/pay/pending?orderId=test-order`,
    reminderNumber: "1",
    orderUrl: `${baseUrl}/account/orders/test-order`,
    productsHtml: "<div><strong>Producto de prueba</strong><br><a href=\"#\">Dejar opinión</a></div>",
    couponCode: "CUMPLE-CLIENTE-A8X4K2",
    discount: "15%",
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString("es-AR"),
    returnCode: "DEV-A8X4K2",
    returnStatus: "APPROVED",
    itemsHtml: "<div><strong>Producto de prueba</strong> · Cantidad 1</div>",
    nextSteps: "Seguí las instrucciones para avanzar.",
    returnInstructions: "Te contactaremos con los próximos pasos.",
    refundAmount: "$10.000",
    refundId: "refund-test",
    refundDate: new Date().toLocaleDateString("es-AR"),
    estimatedAccreditation: "La acreditación puede demorar algunos días hábiles.",
    productName: "Producto de prueba",
    productUrl: `${baseUrl}/products/producto-de-prueba`,
    cartItemsHtml: `
      <div style="display:flex;justify-content:space-between;gap:16px;margin:10px 0;">
        <div>
          <div style="font-weight:700;color:#111;">Producto de prueba</div>
          <div style="font-size:13px;color:#666;">Cantidad: 1 · Unitario: $24.900</div>
        </div>
        <div style="font-weight:700;color:#111;white-space:nowrap;">$24.900</div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:16px;margin:10px 0;">
        <div>
          <div style="font-weight:700;color:#111;">Otro producto</div>
          <div style="font-size:13px;color:#666;">Cantidad: 2 · Unitario: $8.500</div>
        </div>
        <div style="font-weight:700;color:#111;white-space:nowrap;">$17.000</div>
      </div>
      <div style="border-top:1px solid #eee;margin-top:12px;padding-top:12px;text-align:right;font-weight:800;color:#111;">Total: $41.900</div>
    `,
    cartItemsText: "Producto de prueba x1 ($24.900); Otro producto x2 ($17.000). Total: $41.900",
    cartUrl: `${baseUrl}/cart`,
    supportEmail: process.env.SUPPORT_EMAIL || process.env.SMTP_FROM || "soporte@fikastore",
    storeName: "FikaStore",
    storeUrl: baseUrl,
  };
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  await ensureDefaultEmailTemplates();
  const [templates, sentGroups, errorGroups, lastSent, jobSettings] = await Promise.all([
    prisma.emailTemplate.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.emailNotification.groupBy({ by: ["templateKey"], where: { status: "sent", isTest: false }, _count: { _all: true } }),
    prisma.emailNotification.groupBy({ by: ["templateKey"], where: { status: "failed", isTest: false }, _count: { _all: true } }),
    prisma.emailNotification.findMany({
      where: { status: "sent", isTest: false },
      orderBy: { sentAt: "desc" },
      distinct: ["templateKey"],
      select: { templateKey: true, sentAt: true },
    }),
    getEmailJobSettings(),
  ]);

  const sentByKey = new Map(sentGroups.map((item) => [item.templateKey, item._count._all]));
  const errorsByKey = new Map(errorGroups.map((item) => [item.templateKey, item._count._all]));
  const lastSentByKey = new Map(lastSent.map((item) => [item.templateKey, item.sentAt]));

  return NextResponse.json({
    ok: true,
    jobSettings,
    templates: templates.map((template) => ({
      ...template,
      variables: JSON.parse(template.variablesJson || "[]"),
      sentCount: sentByKey.get(template.key) || 0,
      errorCount: errorsByKey.get(template.key) || 0,
      lastSentAt: lastSentByKey.get(template.key) || null,
    })),
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!isAdminRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body.jobSettings) {
    await setEmailJobSettings(body.jobSettings);
    return NextResponse.json({ ok: true, jobSettings: await getEmailJobSettings() });
  }

  const key = String(body.key || "").trim();
  if (!key) return NextResponse.json({ ok: false, error: "Template inválido." }, { status: 400 });

  const template = await prisma.emailTemplate.update({
    where: { key },
    data: {
      enabled: body.enabled === undefined ? undefined : body.enabled === true,
      subject: body.subject === undefined ? undefined : stripRichText(String(body.subject || "")).slice(0, 200),
      html: body.html === undefined ? undefined : sanitizeRichText(String(body.html || "")),
      text: body.text === undefined ? undefined : stripRichText(String(body.text || "")).slice(0, 4000),
    },
  });

  return NextResponse.json({ ok: true, template });
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { role?: string; email?: string | null } | undefined;
  if (!isStaffRole(user?.role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "").trim();
  const key = String(body.key || "").trim() as EmailTemplateKey;

  if (action === "restore") {
    if (!isAdminRole(user?.role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    const template = await restoreDefaultEmailTemplate(key);
    return NextResponse.json({ ok: true, template });
  }

  if (action === "preview") {
    const preview = await renderEmailTemplate(key, samplePayload(req));
    return NextResponse.json({ ok: true, preview: { subject: preview.subject, html: preview.html, text: preview.text } });
  }

  if (action === "test") {
    if (!isAdminRole(user?.role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    const to = String(body.to || user?.email || "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return NextResponse.json({ ok: false, error: "Indicá un email válido." }, { status: 400 });
    }

    await queueAndSendEmailNotification({
      templateKey: key,
      to,
      idempotencyKey: `admin-test:${key}:${Date.now()}:${Math.random().toString(36).slice(2)}`,
      isTest: true,
      payload: samplePayload(req),
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "retry-failed") {
    if (!isAdminRole(user?.role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    const result = await processPendingEmailNotifications(25);
    return NextResponse.json({ ok: true, result });
  }

  return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
}
