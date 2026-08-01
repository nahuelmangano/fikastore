"use client";

import { useState } from "react";
import Link from "next/link";
import type { MailingSettings } from "@/lib/storeSettings";

type AdminMailingPageProps = {
  initialSettings: MailingSettings;
  canSaveSmtpSecrets: boolean;
  canManageSmtp: boolean;
};

export default function AdminMailingPage({ initialSettings, canSaveSmtpSecrets, canManageSmtp }: AdminMailingPageProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [smtpPass, setSmtpPass] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"purchase" | "backInStock" | "smtp" | null>(null);
  const [previewing, setPreviewing] = useState<"purchase" | "backInStock" | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [msg, setMsg] = useState("");

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
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-200">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
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
