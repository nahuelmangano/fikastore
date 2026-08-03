"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { MailingSettings } from "@/lib/storeSettings";

type AdminMailingPageProps = {
  initialSettings: MailingSettings;
  canSaveSmtpSecrets: boolean;
  canManageSmtp: boolean;
  canManageAutomaticEmails: boolean;
};

type AutomaticEmailTemplate = {
  key: string;
  name: string;
  category: string;
  subject: string;
  html: string;
  text: string;
  enabled: boolean;
  variables: string[];
  updatedAt: string;
  lastSentAt: string | null;
  sentCount: number;
  errorCount: number;
};

type EmailJobSettings = {
  paymentRemindersEnabled: boolean;
  paymentReminderHours: number[];
  maxPaymentReminders: number;
  reviewRequestEnabled: boolean;
  reviewRequestDelayDays: number;
  birthdayCouponEnabled: boolean;
  birthdayCouponOffsetDays: number;
  birthdayCouponDiscountType: "percent" | "amount";
  birthdayCouponDiscountValue: number;
  birthdayCouponDurationDays: number;
  birthdayCouponMinPurchaseAmount: number;
  birthdayCouponMaxUses: number;
};

export default function AdminMailingPage({
  initialSettings,
  canSaveSmtpSecrets,
  canManageSmtp,
  canManageAutomaticEmails,
}: AdminMailingPageProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [smtpPass, setSmtpPass] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"purchase" | "backInStock" | "smtp" | null>(null);
  const [previewing, setPreviewing] = useState<"purchase" | "backInStock" | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [automaticTemplates, setAutomaticTemplates] = useState<AutomaticEmailTemplate[]>([]);
  const [jobSettings, setJobSettings] = useState<EmailJobSettings | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [automaticLoading, setAutomaticLoading] = useState(false);
  const [automaticMsg, setAutomaticMsg] = useState("");
  const [msg, setMsg] = useState("");
  const automaticTemplateRows = automaticTemplates.filter((template) => template.key !== "back-in-stock");

  async function loadAutomaticTemplates() {
    setAutomaticLoading(true);
    const res = await fetch("/api/admin/mailing/automatic");
    const data = await res.json().catch(() => null);
    setAutomaticLoading(false);
    if (!res.ok || !data?.ok) {
      setAutomaticMsg(String(data?.error || "No se pudieron cargar los emails automaticos."));
      return;
    }
    setAutomaticTemplates(data.templates || []);
    setJobSettings(data.jobSettings || null);
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialAutomaticTemplates() {
      setAutomaticLoading(true);
      const res = await fetch("/api/admin/mailing/automatic");
      const data = await res.json().catch(() => null);
      if (cancelled) return;
      setAutomaticLoading(false);
      if (!res.ok || !data?.ok) {
        setAutomaticMsg(String(data?.error || "No se pudieron cargar los emails automaticos."));
        return;
      }
      setAutomaticTemplates(data.templates || []);
      setJobSettings(data.jobSettings || null);
    }

    loadInitialAutomaticTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateField<K extends keyof MailingSettings>(field: K, value: MailingSettings[K]) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  async function saveSettings() {
    setSaving(true);
    setMsg("");

    const res = await fetch("/api/admin/mailing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, smtpPass }),
    });
    const data = await res.json().catch(() => null);

    setSaving(false);
    if (!res.ok || !data?.ok) {
      setMsg(String(data?.error || "No se pudo guardar la configuracion de mailing."));
      return;
    }

    setSettings(data.settings);
    setSmtpPass("");
    setMsg("Configuracion de mailing guardada.");
  }

  async function sendTestEmail(template: "purchase" | "backInStock" | "smtp") {
    setTesting(template);
    setMsg("");

    const testPayload =
      template === "purchase"
        ? {
            to: testEmail,
            template,
          }
        : template === "backInStock"
        ? {
            to: testEmail,
            template,
          }
        : { to: testEmail, template };

    const res = await fetch("/api/admin/mailing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(testPayload),
    });
    const data = await res.json().catch(() => null);

    setTesting(null);
    if (!res.ok || !data?.ok) {
      setMsg(String(data?.error || "No se pudo enviar el email de prueba."));
      return;
    }

    setMsg("Email de prueba enviado.");
  }

  async function previewEmail(template: "purchase" | "backInStock") {
    setPreviewing(template);
    setMsg("");

    const payload =
      template === "purchase"
        ? {
            template,
          }
        : template === "backInStock"
        ? {
            template,
          }
        : { template };

    const res = await fetch("/api/admin/mailing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);

    setPreviewing(null);
    if (!res.ok || !data?.ok) {
      setMsg(String(data?.error || "No se pudo generar la previsualizacion."));
      return;
    }

    setPreview(data.preview);
  }

  function selectAutomaticTemplate(template: AutomaticEmailTemplate) {
    setSelectedTemplateKey(template.key);
    setTemplateDraft({ subject: template.subject, html: template.html, text: template.text });
    setAutomaticMsg("");
  }

  async function updateAutomaticTemplate(key: string, patch: Partial<AutomaticEmailTemplate>) {
    if (!canManageAutomaticEmails) return;
    setAutomaticMsg("");
    const res = await fetch("/api/admin/mailing/automatic", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ...patch }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setAutomaticMsg(String(data?.error || "No se pudo guardar la plantilla."));
      return;
    }
    await loadAutomaticTemplates();
    setAutomaticMsg("Plantilla guardada.");
  }

  async function automaticAction(action: string, key?: string) {
    setAutomaticMsg("");
    const res = await fetch("/api/admin/mailing/automatic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, key, to: testEmail }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setAutomaticMsg(String(data?.error || "No se pudo ejecutar la accion."));
      return;
    }
    if (action === "preview") setPreview(data.preview);
    if (action !== "preview") {
      await loadAutomaticTemplates();
      setAutomaticMsg(action === "test" ? "Email de prueba enviado." : "Accion ejecutada.");
    }
  }

  async function saveJobSettings() {
    if (!canManageAutomaticEmails) return;
    if (!jobSettings) return;
    setAutomaticMsg("");
    const res = await fetch("/api/admin/mailing/automatic", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobSettings }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) {
      setAutomaticMsg(String(data?.error || "No se pudo guardar la configuracion de procesos."));
      return;
    }
    setJobSettings(data.jobSettings);
    setAutomaticMsg("Configuracion de procesos guardada.");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10 xl:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · Mailing</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {canManageSmtp ? "Editar los textos y la configuracion SMTP de la tienda." : "Editar los textos que reciben los clientes por email."}
            </p>
          </div>
          <Link href="/admin" className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60">
            Volver
          </Link>
        </div>

        {canManageSmtp ? (
          <section className="mt-8 xl:mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 xl:p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-64 flex-1">
                <TextInput label="Email para probar envios" value={testEmail} onChange={setTestEmail} placeholder="admin@example.com" />
              </div>
              <button
                type="button"
                onClick={() => sendTestEmail("smtp")}
                disabled={testing !== null}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {testing === "smtp" ? "Enviando..." : "Probar SMTP"}
              </button>
            </div>
          </section>
        ) : null}

        <div className="mt-8 xl:mt-6 grid gap-5 xl:gap-4 lg:grid-cols-2">
          <MailBlock
            title="Compra de producto"
            description="Se envia cuando Mercado Pago confirma el pago."
            enabled={settings.purchaseEnabled}
            onEnabledChange={(value) => updateField("purchaseEnabled", value)}
            canSendTest={canManageSmtp}
            testLabel={testing === "purchase" ? "Enviando..." : "Probar compra"}
            testDisabled={testing !== null}
            onTest={() => sendTestEmail("purchase")}
            previewLabel={previewing === "purchase" ? "Cargando..." : "Ver preview"}
            previewDisabled={previewing !== null}
            onPreview={() => previewEmail("purchase")}
          />

          <MailBlock
            title="Vuelta de stock"
            description="Se envia a quienes pidieron aviso cuando un producto vuelve a tener stock."
            enabled={settings.backInStockEnabled}
            onEnabledChange={(value) => updateField("backInStockEnabled", value)}
            canSendTest={canManageSmtp}
            testLabel={testing === "backInStock" ? "Enviando..." : "Probar stock"}
            testDisabled={testing !== null}
            onTest={() => sendTestEmail("backInStock")}
            previewLabel={previewing === "backInStock" ? "Cargando..." : "Ver preview"}
            previewDisabled={previewing !== null}
            onPreview={() => previewEmail("backInStock")}
          />
        </div>

        <MailPreview preview={preview} />

        <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 xl:p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Emails automaticos</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {canManageAutomaticEmails
                  ? "Activa o desactiva cada email automatico por separado."
                  : "Emails automaticos gestionados por el administrador."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canManageAutomaticEmails ? (
                <button
                  type="button"
                  onClick={() => automaticAction("retry-failed")}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
                >
                  Reintentar fallidos
                </button>
              ) : null}
            </div>
          </div>

          {automaticMsg ? <p className="mt-4 text-sm text-zinc-400">{automaticMsg}</p> : null}

          {jobSettings ? (
            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="font-semibold text-zinc-100">Procesos programados</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <label className="text-sm font-medium text-zinc-200">
                  Recordatorios activos
                  <select
                    value={jobSettings.paymentRemindersEnabled ? "on" : "off"}
                    onChange={(e) => setJobSettings((current) => current ? { ...current, paymentRemindersEnabled: e.target.value === "on" } : current)}
                    disabled={!canManageAutomaticEmails}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <option value="on">Habilitado</option>
                    <option value="off">Deshabilitado</option>
                  </select>
                </label>
                <TextInput
                  label="Horas recordatorio"
                  value={jobSettings.paymentReminderHours.join(",")}
                  onChange={(value) => setJobSettings((current) => current ? { ...current, paymentReminderHours: value.split(",").map((item) => Number(item.trim())).filter((item) => Number.isFinite(item)) } : current)}
                  placeholder="24,48"
                  disabled={!canManageAutomaticEmails}
                />
                <TextInput
                  label="Maximo recordatorios"
                  value={String(jobSettings.maxPaymentReminders)}
                  onChange={(value) => setJobSettings((current) => current ? { ...current, maxPaymentReminders: Number(value) } : current)}
                  disabled={!canManageAutomaticEmails}
                />
                <label className="text-sm font-medium text-zinc-200">
                  Opiniones activas
                  <select
                    value={jobSettings.reviewRequestEnabled ? "on" : "off"}
                    onChange={(e) => setJobSettings((current) => current ? { ...current, reviewRequestEnabled: e.target.value === "on" } : current)}
                    disabled={!canManageAutomaticEmails}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <option value="on">Habilitado</option>
                    <option value="off">Deshabilitado</option>
                  </select>
                </label>
                <TextInput
                  label="Dias para opinion"
                  value={String(jobSettings.reviewRequestDelayDays)}
                  onChange={(value) => setJobSettings((current) => current ? { ...current, reviewRequestDelayDays: Number(value) } : current)}
                  disabled={!canManageAutomaticEmails}
                />
                <label className="text-sm font-medium text-zinc-200">
                  Cumpleanos activos
                  <select
                    value={jobSettings.birthdayCouponEnabled ? "on" : "off"}
                    onChange={(e) => setJobSettings((current) => current ? { ...current, birthdayCouponEnabled: e.target.value === "on" } : current)}
                    disabled={!canManageAutomaticEmails}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <option value="on">Habilitado</option>
                    <option value="off">Deshabilitado</option>
                  </select>
                </label>
                <TextInput label="Offset cumpleanos" value={String(jobSettings.birthdayCouponOffsetDays)} onChange={(value) => setJobSettings((current) => current ? { ...current, birthdayCouponOffsetDays: Number(value) } : current)} disabled={!canManageAutomaticEmails} />
                <TextInput label="Descuento cumpleanos" value={String(jobSettings.birthdayCouponDiscountValue)} onChange={(value) => setJobSettings((current) => current ? { ...current, birthdayCouponDiscountValue: Number(value) } : current)} disabled={!canManageAutomaticEmails} />
                <TextInput label="Duracion cupon dias" value={String(jobSettings.birthdayCouponDurationDays)} onChange={(value) => setJobSettings((current) => current ? { ...current, birthdayCouponDurationDays: Number(value) } : current)} disabled={!canManageAutomaticEmails} />
              </div>
              {canManageAutomaticEmails ? (
                <button type="button" onClick={saveJobSettings} className="mt-4 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
                  Guardar procesos
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead className="text-left text-zinc-400">
                <tr className="border-b border-zinc-800">
                  <th className="py-3 pr-3">Email</th>
                  <th className="py-3 pr-3">Categoria</th>
                  <th className="py-3 pr-3">Estado</th>
                  <th className="py-3 pr-3">Ultima modificacion</th>
                  <th className="py-3 pr-3">Ultimo envio</th>
                  <th className="py-3 pr-3">Envios</th>
                  <th className="py-3 pr-3">Errores</th>
                  <th className="py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {automaticTemplateRows.map((template) => (
                  <tr key={template.key} className="border-b border-zinc-800/70">
                    <td className="py-3 pr-3 font-semibold text-zinc-100">{template.name}</td>
                    <td className="py-3 pr-3 text-zinc-300">{template.category}</td>
                    <td className="py-3 pr-3">
                      <button
                        type="button"
                        onClick={() => updateAutomaticTemplate(template.key, { enabled: !template.enabled })}
                        disabled={!canManageAutomaticEmails}
                        className={[
                          "rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed",
                          template.enabled
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                            : "border-zinc-700 bg-zinc-950 text-zinc-400",
                        ].join(" ")}
                        >
                          {template.enabled ? "Habilitado" : "Deshabilitado"}
                      </button>
                    </td>
                    <td className="py-3 pr-3 text-zinc-400">{new Date(template.updatedAt).toLocaleString("es-AR")}</td>
                    <td className="py-3 pr-3 text-zinc-400">{template.lastSentAt ? new Date(template.lastSentAt).toLocaleString("es-AR") : "-"}</td>
                    <td className="py-3 pr-3 text-zinc-300">{template.sentCount}</td>
                    <td className="py-3 pr-3 text-zinc-300">{template.errorCount}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => automaticAction("preview", template.key)} className="rounded-xl border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-100 hover:bg-zinc-900">Preview</button>
                        {canManageAutomaticEmails ? (
                          <button
                            type="button"
                            onClick={() => updateAutomaticTemplate(template.key, { enabled: !template.enabled })}
                            className="rounded-xl border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-100 hover:bg-zinc-900"
                          >
                            {template.enabled ? "Desactivar" : "Activar"}
                          </button>
                        ) : null}
                        {canManageAutomaticEmails ? <button type="button" onClick={() => selectAutomaticTemplate(template)} className="rounded-xl border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-100 hover:bg-zinc-900">Editar</button> : null}
                        {canManageAutomaticEmails ? <button type="button" onClick={() => automaticAction("test", template.key)} className="rounded-xl border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-100 hover:bg-zinc-900">Prueba</button> : null}
                        {canManageAutomaticEmails ? <button type="button" onClick={() => automaticAction("restore", template.key)} className="rounded-xl border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-100 hover:bg-zinc-900">Restaurar</button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {automaticLoading ? <p className="mt-4 text-sm text-zinc-400">Cargando...</p> : null}
          </div>

          {selectedTemplateKey && templateDraft ? (
            <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold text-zinc-100">{automaticTemplates.find((item) => item.key === selectedTemplateKey)?.name}</h3>
                <button type="button" onClick={() => setSelectedTemplateKey(null)} className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-100">Cerrar</button>
              </div>
              <div className="mt-4 grid gap-4">
                <TextInput label="Asunto" value={templateDraft.subject} onChange={(value) => setTemplateDraft((current) => current ? { ...current, subject: value } : current)} />
                <label className="block text-sm font-medium text-zinc-200">
                  HTML
                  <textarea value={templateDraft.html} onChange={(e) => setTemplateDraft((current) => current ? { ...current, html: e.target.value } : current)} rows={8} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
                </label>
                <label className="block text-sm font-medium text-zinc-200">
                  Texto plano
                  <textarea value={templateDraft.text} onChange={(e) => setTemplateDraft((current) => current ? { ...current, text: e.target.value } : current)} rows={4} className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500" />
                </label>
                <p className="text-xs text-zinc-500">
                  Variables: {(automaticTemplates.find((item) => item.key === selectedTemplateKey)?.variables || []).map((variable) => `{{${variable}}}`).join(" ")}
                </p>
                <button
                  type="button"
                  onClick={() => updateAutomaticTemplate(selectedTemplateKey, templateDraft)}
                  className="w-fit rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
                >
                  Guardar plantilla
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {canManageSmtp ? (
        <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 xl:p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Servicio SMTP</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Configuracion administrativa del remitente. Si queda incompleta, se usa el SMTP definido en .env.
              </p>
            </div>
            <span className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-zinc-300">
              {settings.smtpSource === "admin" ? "Usando admin" : settings.smtpSource === "env" ? "Usando .env" : "Sin SMTP"}
            </span>
          </div>

          {!canSaveSmtpSecrets ? (
            <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
              Falta MAILING_ENCRYPTION_KEY. Se puede usar el SMTP del .env, pero no guardar una contrasena nueva desde el panel.
            </p>
          ) : null}

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <TextInput label="Host SMTP" value={settings.smtpHost} onChange={(value) => updateField("smtpHost", value)} placeholder="smtp.example.com" />
            <TextInput label="Puerto" value={settings.smtpPort} onChange={(value) => updateField("smtpPort", value)} placeholder="587" />
            <TextInput label="Usuario SMTP" value={settings.smtpUser} onChange={(value) => updateField("smtpUser", value)} placeholder="ventas@example.com" />
            <TextInput label="Email remitente" value={settings.smtpFrom} onChange={(value) => updateField("smtpFrom", value)} placeholder="ventas@example.com" />
            <TextInput label="Responder a" value={settings.smtpReplyTo} onChange={(value) => updateField("smtpReplyTo", value)} placeholder="soporte@example.com" />
            <label className="block text-sm font-medium text-zinc-200">
              Contrasena SMTP
              <input
                type="password"
                value={smtpPass}
                onChange={(e) => setSmtpPass(e.target.value)}
                placeholder={settings.smtpPassConfigured ? "Configurada. Completar para reemplazar." : "App password o clave SMTP"}
                disabled={!canSaveSmtpSecrets}
                autoComplete="new-password"
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
              {settings.smtpPassConfigured ? <span className="mt-2 block text-xs text-zinc-500">La contrasena guardada no se muestra.</span> : null}
            </label>
          </div>

        </section>
        ) : null}

        <div className="mt-6 xl:mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
          {msg ? <p className="text-sm text-zinc-400">{msg}</p> : null}
        </div>
      </div>
    </main>
  );
}

function TextInput({
  label,
  value,
  placeholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-200">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </label>
  );
}

function MailPreview({ preview }: { preview: { subject: string; html: string } | null }) {
  if (!preview) return null;

  return (
    <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 xl:p-4">
      <div>
        <h2 className="text-base font-semibold">Preview real del mail</h2>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-white">
        <iframe
          title="Preview del email"
          srcDoc={preview.html}
          className="h-[560px] w-full bg-white"
          sandbox=""
        />
      </div>
    </section>
  );
}

function MailBlock({
  title,
  description,
  enabled,
  onEnabledChange,
  canSendTest,
  testLabel,
  testDisabled,
  onTest,
  previewLabel,
  previewDisabled,
  onPreview,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  canSendTest?: boolean;
  testLabel?: string;
  testDisabled?: boolean;
  onTest?: () => void;
  previewLabel: string;
  previewDisabled: boolean;
  onPreview: () => void;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 xl:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => onEnabledChange(!enabled)}
          className={[
            "shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold",
            enabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
              : "border-zinc-700 bg-zinc-950 text-zinc-400 hover:bg-zinc-900",
          ].join(" ")}
          aria-pressed={enabled}
        >
          {enabled ? "Habilitado" : "Deshabilitado"}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={onPreview}
          disabled={previewDisabled}
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {previewLabel}
        </button>
        {canSendTest && onTest ? (
          <button
            type="button"
            onClick={onTest}
            disabled={testDisabled}
            className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {testLabel || "Probar envio"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
