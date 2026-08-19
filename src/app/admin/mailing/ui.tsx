"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { MailingSettings } from "@/lib/storeSettings";
import { sanitizeRichText, stripRichText } from "@/lib/richText";

type AdminMailingPageProps = {
  initialSettings: MailingSettings;
  canSaveSmtpSecrets: boolean;
  canManageSmtp: boolean;
  canManageAutomaticEmails: boolean;
  canManageAutomaticEmailAdminActions: boolean;
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
  canManageAutomaticEmailAdminActions,
}: AdminMailingPageProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpMicrosoftClientSecret, setSmtpMicrosoftClientSecret] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"purchase" | "backInStock" | "smtp" | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [automaticTemplates, setAutomaticTemplates] = useState<AutomaticEmailTemplate[]>([]);
  const [jobSettings, setJobSettings] = useState<EmailJobSettings | null>(null);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [automaticLoading, setAutomaticLoading] = useState(false);
  const [automaticBusy, setAutomaticBusy] = useState<{ action: string; key?: string } | null>(null);
  const [automaticMsg, setAutomaticMsg] = useState("");
  const [msg, setMsg] = useState("");
  const previewRef = useRef<HTMLElement | null>(null);
  const templateHtmlRef = useRef<HTMLDivElement | null>(null);
  const shouldScrollToPreviewRef = useRef(false);
  const searchParams = useSearchParams();
  const microsoftRedirectUri =
    typeof window === "undefined"
      ? "/api/admin/mailing/microsoft/oauth/callback"
      : `${window.location.origin}/api/admin/mailing/microsoft/oauth/callback`;
  const automaticTemplateRows = automaticTemplates;

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

  useEffect(() => {
    if (!preview || !shouldScrollToPreviewRef.current) return;
    shouldScrollToPreviewRef.current = false;
    requestAnimationFrame(() => {
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [preview]);

  useEffect(() => {
    const microsoftStatus = searchParams.get("microsoft");
    if (!microsoftStatus) return;

    const messages: Record<string, string> = {
      connected: "Cuenta Microsoft conectada para SMTP OAuth2.",
      missing_config: "Completá usuario SMTP, Client ID y Client Secret antes de conectar Microsoft.",
      invalid_state: "La conexión con Microsoft venció. Intentá nuevamente.",
      token_error: "Microsoft no pudo completar la autorización. Revisá credenciales y redirect URI.",
      forbidden: "No tenés permisos para conectar Microsoft.",
    };

    setMsg(messages[microsoftStatus] || `Microsoft OAuth2: ${microsoftStatus}`);
  }, [searchParams]);

  function updateField<K extends keyof MailingSettings>(field: K, value: MailingSettings[K]) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function setSmtpAuthType(authType: MailingSettings["smtpAuthType"]) {
    setSettings((current) => ({
      ...current,
      smtpAuthType: authType,
      smtpHost: authType === "microsoft_oauth2" && !current.smtpHost ? "smtp.office365.com" : current.smtpHost,
      smtpPort: authType === "microsoft_oauth2" ? "587" : current.smtpPort,
      smtpMicrosoftTenantId:
        authType === "microsoft_oauth2" && !current.smtpMicrosoftTenantId ? "common" : current.smtpMicrosoftTenantId,
    }));
  }

  async function saveSettings() {
    setSaving(true);
    setMsg("");

    const res = await fetch("/api/admin/mailing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...settings, smtpPass, smtpMicrosoftClientSecret }),
    });
    const data = await res.json().catch(() => null);

    setSaving(false);
    if (!res.ok || !data?.ok) {
      setMsg(String(data?.error || "No se pudo guardar la configuracion de mailing."));
      return;
    }

    setSettings(data.settings);
    setSmtpPass("");
    setSmtpMicrosoftClientSecret("");
    setMsg("Configuracion de mailing guardada.");
  }

  async function disconnectMicrosoftOAuth() {
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/mailing/microsoft/disconnect", { method: "POST" });
    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok || !data?.ok) {
      setMsg(String(data?.error || "No se pudo desconectar Microsoft."));
      return;
    }

    setSettings(data.settings);
    setMsg("Cuenta Microsoft desconectada.");
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

  function selectAutomaticTemplate(template: AutomaticEmailTemplate) {
    const html = sanitizeRichText(template.html);
    setSelectedTemplateKey(template.key);
    setTemplateDraft({ subject: template.subject, html, text: template.text || stripRichText(html) });
    setAutomaticMsg("");
    requestAnimationFrame(() => {
      if (templateHtmlRef.current) templateHtmlRef.current.innerHTML = html;
    });
  }

  function syncTemplateHtmlFromEditor() {
    const html = sanitizeRichText(templateHtmlRef.current?.innerHTML ?? "");
    setTemplateDraft((current) => current ? { ...current, html, text: stripRichText(html) } : current);
  }

  function formatTemplateContent(command: string, value?: string) {
    templateHtmlRef.current?.focus();
    document.execCommand(command, false, value);
    syncTemplateHtmlFromEditor();
  }

  function addTemplateLink() {
    const url = window.prompt("URL del enlace");
    if (!url?.trim()) return;
    formatTemplateContent("createLink", url.trim());
  }

  function insertTemplateVariable(variable: string) {
    templateHtmlRef.current?.focus();
    document.execCommand("insertText", false, `{{${variable}}}`);
    syncTemplateHtmlFromEditor();
  }

  async function updateAutomaticTemplate(key: string, patch: Partial<AutomaticEmailTemplate>) {
    if (!canManageAutomaticEmails) return;
    const action = patch.enabled === undefined ? "save-template" : "toggle";
    setAutomaticBusy({ action, key });
    setAutomaticMsg("");
    try {
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
    } finally {
      setAutomaticBusy(null);
    }
  }

  async function automaticAction(action: string, key?: string) {
    setAutomaticBusy({ action, key });
    setAutomaticMsg("");
    try {
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
      if (action === "preview") {
        shouldScrollToPreviewRef.current = true;
        setPreview(data.preview);
      }
      if (action !== "preview") {
        await loadAutomaticTemplates();
        setAutomaticMsg(action === "test" ? "Email de prueba enviado." : "Accion ejecutada.");
      }
    } finally {
      setAutomaticBusy(null);
    }
  }

  async function saveJobSettings() {
    if (!canManageAutomaticEmailAdminActions) return;
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

        <section className="mt-8 xl:mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 xl:p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold">Emails automaticos</h2>
              <p className="mt-1 text-sm text-zinc-400">
                {canManageAutomaticEmails
                  ? "Edita el asunto y el contenido que reciben los clientes."
                  : "Emails automaticos gestionados por el administrador."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {canManageAutomaticEmailAdminActions ? (
                <button
                  type="button"
                  onClick={() => automaticAction("retry-failed")}
                  disabled={automaticBusy !== null}
                  className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {automaticBusy?.action === "retry-failed" ? "Reintentando..." : "Reintentar fallidos"}
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
                    disabled={!canManageAutomaticEmailAdminActions}
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
                  disabled={!canManageAutomaticEmailAdminActions}
                />
                <TextInput
                  label="Maximo recordatorios"
                  value={String(jobSettings.maxPaymentReminders)}
                  onChange={(value) => setJobSettings((current) => current ? { ...current, maxPaymentReminders: Number(value) } : current)}
                  disabled={!canManageAutomaticEmailAdminActions}
                />
                <label className="text-sm font-medium text-zinc-200">
                  Opiniones activas
                  <select
                    value={jobSettings.reviewRequestEnabled ? "on" : "off"}
                    onChange={(e) => setJobSettings((current) => current ? { ...current, reviewRequestEnabled: e.target.value === "on" } : current)}
                    disabled={!canManageAutomaticEmailAdminActions}
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
                  disabled={!canManageAutomaticEmailAdminActions}
                />
                <label className="text-sm font-medium text-zinc-200">
                  Cumpleanos activos
                  <select
                    value={jobSettings.birthdayCouponEnabled ? "on" : "off"}
                    onChange={(e) => setJobSettings((current) => current ? { ...current, birthdayCouponEnabled: e.target.value === "on" } : current)}
                    disabled={!canManageAutomaticEmailAdminActions}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                  >
                    <option value="on">Habilitado</option>
                    <option value="off">Deshabilitado</option>
                  </select>
                </label>
                <TextInput label="Offset cumpleanos" value={String(jobSettings.birthdayCouponOffsetDays)} onChange={(value) => setJobSettings((current) => current ? { ...current, birthdayCouponOffsetDays: Number(value) } : current)} disabled={!canManageAutomaticEmailAdminActions} />
                <TextInput label="Descuento cumpleanos" value={String(jobSettings.birthdayCouponDiscountValue)} onChange={(value) => setJobSettings((current) => current ? { ...current, birthdayCouponDiscountValue: Number(value) } : current)} disabled={!canManageAutomaticEmailAdminActions} />
                <TextInput label="Duracion cupon dias" value={String(jobSettings.birthdayCouponDurationDays)} onChange={(value) => setJobSettings((current) => current ? { ...current, birthdayCouponDurationDays: Number(value) } : current)} disabled={!canManageAutomaticEmailAdminActions} />
              </div>
              {canManageAutomaticEmailAdminActions ? (
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
                {automaticTemplateRows.map((template) => {
                  const isBusy = (action: string) => automaticBusy?.key === template.key && automaticBusy.action === action;
                  const rowBusy = automaticBusy?.key === template.key;
                  const anyBusy = automaticBusy !== null;
                  const actionButtonClass = "rounded-xl border border-zinc-700 px-3 py-1.5 font-semibold text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60";

                  return (
                    <tr key={template.key} className="border-b border-zinc-800/70">
                      <td className="py-3 pr-3 font-semibold text-zinc-100">{template.name}</td>
                      <td className="py-3 pr-3 text-zinc-300">{template.category}</td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          onClick={() => updateAutomaticTemplate(template.key, { enabled: !template.enabled })}
                          disabled={!canManageAutomaticEmails || anyBusy}
                          className={[
                            "rounded-xl border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60",
                            template.enabled
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                              : "border-zinc-700 bg-zinc-950 text-zinc-400",
                          ].join(" ")}
                          >
                            {isBusy("toggle") ? "Guardando..." : template.enabled ? "Habilitado" : "Deshabilitado"}
                        </button>
                      </td>
                      <td className="py-3 pr-3 text-zinc-400">{new Date(template.updatedAt).toLocaleString("es-AR")}</td>
                      <td className="py-3 pr-3 text-zinc-400">{template.lastSentAt ? new Date(template.lastSentAt).toLocaleString("es-AR") : "-"}</td>
                      <td className="py-3 pr-3 text-zinc-300">{template.sentCount}</td>
                      <td className="py-3 pr-3 text-zinc-300">{template.errorCount}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => automaticAction("preview", template.key)} disabled={anyBusy} className={actionButtonClass}>
                            {isBusy("preview") ? "Cargando..." : "Preview"}
                          </button>
                          {canManageAutomaticEmails ? (
                            <button
                              type="button"
                              onClick={() => updateAutomaticTemplate(template.key, { enabled: !template.enabled })}
                              disabled={anyBusy}
                              className={actionButtonClass}
                            >
                              {isBusy("toggle") ? "Guardando..." : template.enabled ? "Desactivar" : "Activar"}
                            </button>
                          ) : null}
                          {canManageAutomaticEmails ? (
                            <button type="button" onClick={() => selectAutomaticTemplate(template)} disabled={rowBusy} className={actionButtonClass}>
                              Editar
                            </button>
                          ) : null}
                          {canManageAutomaticEmailAdminActions ? (
                            <button type="button" onClick={() => automaticAction("test", template.key)} disabled={anyBusy} className={actionButtonClass}>
                              {isBusy("test") ? "Enviando..." : "Prueba"}
                            </button>
                          ) : null}
                          {canManageAutomaticEmailAdminActions ? (
                            <button type="button" onClick={() => automaticAction("restore", template.key)} disabled={anyBusy} className={actionButtonClass}>
                              {isBusy("restore") ? "Restaurando..." : "Restaurar"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
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
                  Contenido del email
                  <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                    <div className="flex flex-wrap gap-2 border-b border-zinc-800 p-2">
                      <EditorButton onClick={() => formatTemplateContent("bold")}>Negrita</EditorButton>
                      <EditorButton onClick={() => formatTemplateContent("italic")}>Itálica</EditorButton>
                      <EditorButton onClick={() => formatTemplateContent("underline")}>Subrayar</EditorButton>
                      <EditorButton onClick={() => formatTemplateContent("formatBlock", "h2")}>Título</EditorButton>
                      <EditorButton onClick={() => formatTemplateContent("insertUnorderedList")}>Lista</EditorButton>
                      <EditorButton onClick={addTemplateLink}>Link</EditorButton>
                    </div>
                    <div
                      key={selectedTemplateKey}
                      ref={templateHtmlRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={syncTemplateHtmlFromEditor}
                      onBlur={syncTemplateHtmlFromEditor}
                      className="min-h-56 w-full bg-zinc-950 px-4 py-3 text-sm leading-6 text-zinc-100 outline-none [&_a]:text-sky-300 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2"
                    />
                  </div>
                </label>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Variables disponibles</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(automaticTemplates.find((item) => item.key === selectedTemplateKey)?.variables || []).map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        onClick={() => insertTemplateVariable(variable)}
                        className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-semibold text-zinc-200 hover:bg-zinc-900"
                      >
                        {`{{${variable}}}`}
                      </button>
                    ))}
                  </div>
                </div>
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

        <MailPreview ref={previewRef} preview={preview} onClose={() => setPreview(null)} />

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

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSmtpAuthType("password")}
              className={[
                "rounded-2xl border p-4 text-left transition",
                settings.smtpAuthType === "password"
                  ? "border-zinc-100 bg-zinc-100 text-zinc-950"
                  : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold">SMTP genérico</span>
              <span className={settings.smtpAuthType === "password" ? "mt-1 block text-xs text-zinc-700" : "mt-1 block text-xs text-zinc-500"}>
                Usá host, puerto, usuario y contraseña o app password.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSmtpAuthType("microsoft_oauth2")}
              className={[
                "rounded-2xl border p-4 text-left transition",
                settings.smtpAuthType === "microsoft_oauth2"
                  ? "border-sky-200 bg-sky-50 text-sky-950"
                  : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold">Hotmail / Outlook</span>
              <span className={settings.smtpAuthType === "microsoft_oauth2" ? "mt-1 block text-xs text-sky-800" : "mt-1 block text-xs text-zinc-500"}>
                Conectá Microsoft OAuth2 para enviar desde Outlook.
              </span>
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-medium text-zinc-200">
              Tipo de autenticacion
              <select
                value={settings.smtpAuthType}
                onChange={(e) => setSmtpAuthType(e.target.value === "microsoft_oauth2" ? "microsoft_oauth2" : "password")}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
              >
                <option value="password">SMTP generico con contrasena</option>
                <option value="microsoft_oauth2">Hotmail / Outlook con Microsoft OAuth2</option>
              </select>
            </label>
            <div className="hidden md:block" />
            <TextInput label="Host SMTP" value={settings.smtpHost} onChange={(value) => updateField("smtpHost", value)} placeholder="smtp.example.com" />
            <TextInput label="Puerto" value={settings.smtpPort} onChange={(value) => updateField("smtpPort", value)} placeholder="587" />
            <TextInput label="Usuario SMTP" value={settings.smtpUser} onChange={(value) => updateField("smtpUser", value)} placeholder="ventas@example.com" />
            <TextInput label="Email remitente" value={settings.smtpFrom} onChange={(value) => updateField("smtpFrom", value)} placeholder="ventas@example.com" />
            <TextInput label="Responder a" value={settings.smtpReplyTo} onChange={(value) => updateField("smtpReplyTo", value)} placeholder="soporte@example.com" />
            {settings.smtpAuthType === "password" ? (
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
            ) : (
              <>
                <div className="md:col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950">
                  <div className="font-semibold">Configuración Hotmail / Outlook</div>
                  <p className="mt-1">
                    Completá el usuario de Outlook, Client ID y Client Secret, guardá cambios y después presioná
                    <strong> Conectar Outlook</strong>.
                  </p>
                </div>
                <TextInput
                  label="Microsoft Client ID"
                  value={settings.smtpMicrosoftClientId}
                  onChange={(value) => updateField("smtpMicrosoftClientId", value)}
                  placeholder="Application (client) ID"
                />
                <TextInput
                  label="Microsoft Tenant ID"
                  value={settings.smtpMicrosoftTenantId}
                  onChange={(value) => updateField("smtpMicrosoftTenantId", value)}
                  placeholder="common"
                />
                <label className="block text-sm font-medium text-zinc-200">
                  Microsoft Client Secret
                  <input
                    type="password"
                    value={smtpMicrosoftClientSecret}
                    onChange={(e) => setSmtpMicrosoftClientSecret(e.target.value)}
                    placeholder={settings.smtpMicrosoftClientSecretConfigured ? "Configurado. Completar para reemplazar." : "Client secret value"}
                    disabled={!canSaveSmtpSecrets}
                    autoComplete="new-password"
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {settings.smtpMicrosoftClientSecretConfigured ? <span className="mt-2 block text-xs text-zinc-500">El secreto guardado no se muestra.</span> : null}
                </label>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
                  <div className="font-semibold text-zinc-200">OAuth2 Microsoft</div>
                  <p className="mt-2">
                    Guardá primero usuario, Client ID y Client Secret. Después conectá la cuenta para obtener el permiso SMTP.
                  </p>
                  <p className="mt-2 font-mono text-xs text-zinc-500">
                    Redirect URI: {microsoftRedirectUri}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href="/api/admin/mailing/microsoft/oauth/start"
                      className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
                    >
                      {settings.smtpMicrosoftRefreshTokenConfigured ? "Reconectar Outlook" : "Conectar Outlook"}
                    </a>
                    {settings.smtpMicrosoftRefreshTokenConfigured ? (
                      <button
                        type="button"
                        onClick={disconnectMicrosoftOAuth}
                        disabled={saving}
                        className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Desconectar
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-3 text-xs text-zinc-500">
                    Estado: {settings.smtpMicrosoftRefreshTokenConfigured ? "OAuth conectado" : "OAuth sin conectar"}
                  </div>
                </div>
              </>
            )}
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

function EditorButton({ children, onClick }: { children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-100 hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}

const MailPreview = forwardRef<HTMLElement, {
  preview: { subject: string; html: string } | null;
  onClose: () => void;
}>(function MailPreview({
  preview,
  onClose,
}, ref) {
  if (!preview) return null;

  return (
    <section ref={ref} className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 xl:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Preview real del mail</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-zinc-700 px-3 py-1.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
        >
          Cerrar
        </button>
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
});
