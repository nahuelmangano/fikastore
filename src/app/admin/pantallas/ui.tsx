"use client";

import { useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { CheckCircle2, ChevronDown, Clock3, Eye, Mail, Monitor, Search, ShoppingBag, XCircle } from "lucide-react";
import type { ScreenTextSettings } from "@/lib/storeSettings";

type SaveState = "idle" | "saving" | "saved" | "error";

const exampleItems = [
  { name: "Pantalon elefantes", variant: "Talle: S / Diseño: Elefantes", quantity: 1, unitPrice: 50900, subtotal: 50900 },
  { name: "Remera basica", variant: "Color: Natural / Talle: M", quantity: 2, unitPrice: 18500, subtotal: 37000 },
];

type ScreenTextField = { key: keyof ScreenTextSettings; label: string; multiline?: boolean };

const paymentSuccessFields: ScreenTextField[] = [
  { key: "paymentSuccessTitle", label: "Titulo" },
  { key: "paymentSuccessSubtitle", label: "Subtitulo", multiline: true },
  { key: "paymentSuccessHint", label: "Ayuda", multiline: true },
  { key: "paymentSuccessBackToStoreButton", label: "Boton tienda" },
  { key: "paymentSuccessViewOrderButton", label: "Boton pedido" },
];

const orderCreatedFields: ScreenTextField[] = [
  { key: "orderCreatedTitle", label: "Titulo" },
  { key: "orderCreatedNumberLabel", label: "Label del numero" },
  { key: "orderCreatedPaymentLabel", label: "Label de pago" },
  { key: "orderCreatedMercadoPagoText", label: "Texto Mercado Pago", multiline: true },
  { key: "orderCreatedMercadoPagoButton", label: "Boton" },
  { key: "orderCreatedStockNote", label: "Nota inferior", multiline: true },
];

const paymentPendingFields: ScreenTextField[] = [
  { key: "paymentPendingTitle", label: "Titulo" },
  { key: "paymentPendingSubtitle", label: "Subtitulo", multiline: true },
  { key: "paymentPendingBoxTitle", label: "Titulo del bloque" },
  { key: "paymentPendingInstructions", label: "Instrucciones", multiline: true },
  { key: "paymentPendingButton", label: "Boton" },
];

const paymentFailureFields: ScreenTextField[] = [
  { key: "paymentFailureTitle", label: "Titulo" },
  { key: "paymentFailureSubtitle", label: "Subtitulo", multiline: true },
  { key: "paymentFailureHint", label: "Ayuda", multiline: true },
  { key: "paymentFailureBackToStoreButton", label: "Boton tienda" },
  { key: "paymentFailureViewOrderButton", label: "Boton pedido" },
];

const manualPaymentFields: ScreenTextField[] = [
  { key: "manualPaymentTitle", label: "Titulo" },
  { key: "manualPaymentSubtitle", label: "Subtitulo" },
  { key: "manualPaymentInstructionsTitle", label: "Titulo de instrucciones" },
  { key: "manualPaymentEmailNote", label: "Nota email", multiline: true },
];

const orderLookupFields: ScreenTextField[] = [
  { key: "orderLookupTitle", label: "Titulo" },
  { key: "orderLookupSubtitle", label: "Subtitulo", multiline: true },
  { key: "orderLookupOrderLabel", label: "Label pedido" },
  { key: "orderLookupEmailLabel", label: "Label email" },
  { key: "orderLookupButton", label: "Boton" },
];

function money(value: number) {
  return `$${value.toLocaleString("es-AR")}`;
}

export default function AdminScreensPage({ initialSettings }: { initialSettings: ScreenTextSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [saveStateByScreen, setSaveStateByScreen] = useState<Record<string, SaveState>>({});
  const [errorByScreen, setErrorByScreen] = useState<Record<string, string>>({});

  const subtotal = exampleItems.reduce((acc, item) => acc + item.subtotal, 0);
  const shipping = 3500;
  const total = subtotal + shipping;

  async function save(screenKey: string) {
    setSaveStateByScreen((current) => ({ ...current, [screenKey]: "saving" }));
    setErrorByScreen((current) => ({ ...current, [screenKey]: "" }));

    const res = await fetch("/api/admin/screens", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      setSaveStateByScreen((current) => ({ ...current, [screenKey]: "error" }));
      setErrorByScreen((current) => ({ ...current, [screenKey]: String(data?.error || "No se pudo guardar.") }));
      return;
    }

    setSettings(data.settings);
    setSaveStateByScreen((current) => ({ ...current, [screenKey]: "saved" }));
  }

  return (
    <main className="min-h-screen bg-[var(--admin-background)] text-[var(--admin-text-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex items-start gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--admin-primary)] shadow-sm">
              <Monitor className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Sistema</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--admin-text)]">Pantallas</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--admin-muted)]">
                Editá los textos que ve el usuario en pantallas clave del checkout.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <div className="space-y-4">
            <PreviewShell title="Después de pagar con éxito" status="Pedido generado">
              <ScreenEditorPreview
                fields={paymentSuccessFields}
                screenKey="payment-success"
                settings={settings}
                setSettings={setSettings}
                saveState={saveStateByScreen["payment-success"] || "idle"}
                error={errorByScreen["payment-success"] || ""}
                onDirty={() => setSaveStateByScreen((current) => ({ ...current, "payment-success": "idle" }))}
                onSave={() => void save("payment-success")}
              >
                <SuccessPreview settings={settings} subtotal={subtotal} shipping={shipping} total={total} />
              </ScreenEditorPreview>
            </PreviewShell>

            <PreviewShell title="Después de crear el pedido" status="Antes del pago" amber>
              <ScreenEditorPreview
                fields={orderCreatedFields}
                screenKey="order-created"
                settings={settings}
                setSettings={setSettings}
                saveState={saveStateByScreen["order-created"] || "idle"}
                error={errorByScreen["order-created"] || ""}
                onDirty={() => setSaveStateByScreen((current) => ({ ...current, "order-created": "idle" }))}
                onSave={() => void save("order-created")}
              >
                <OrderCreatedPreview settings={settings} />
              </ScreenEditorPreview>
            </PreviewShell>

            <PreviewShell title="Pago pendiente" status="Pendiente" amber>
              <ScreenEditorPreview
                fields={paymentPendingFields}
                screenKey="payment-pending"
                settings={settings}
                setSettings={setSettings}
                saveState={saveStateByScreen["payment-pending"] || "idle"}
                error={errorByScreen["payment-pending"] || ""}
                onDirty={() => setSaveStateByScreen((current) => ({ ...current, "payment-pending": "idle" }))}
                onSave={() => void save("payment-pending")}
              >
                <PaymentPendingPreview settings={settings} subtotal={subtotal} shipping={shipping} total={total} />
              </ScreenEditorPreview>
            </PreviewShell>

            <PreviewShell title="Pago rechazado" status="Rechazado" danger>
              <ScreenEditorPreview
                fields={paymentFailureFields}
                screenKey="payment-failure"
                settings={settings}
                setSettings={setSettings}
                saveState={saveStateByScreen["payment-failure"] || "idle"}
                error={errorByScreen["payment-failure"] || ""}
                onDirty={() => setSaveStateByScreen((current) => ({ ...current, "payment-failure": "idle" }))}
                onSave={() => void save("payment-failure")}
              >
                <PaymentFailurePreview settings={settings} />
              </ScreenEditorPreview>
            </PreviewShell>

            <PreviewShell title="Pedido creado con pago manual" status="Pago manual" amber>
              <ScreenEditorPreview
                fields={manualPaymentFields}
                screenKey="manual-payment"
                settings={settings}
                setSettings={setSettings}
                saveState={saveStateByScreen["manual-payment"] || "idle"}
                error={errorByScreen["manual-payment"] || ""}
                onDirty={() => setSaveStateByScreen((current) => ({ ...current, "manual-payment": "idle" }))}
                onSave={() => void save("manual-payment")}
              >
                <ManualPaymentPreview settings={settings} />
              </ScreenEditorPreview>
            </PreviewShell>

            <PreviewShell title="Consulta de pedido" status="Post compra">
              <ScreenEditorPreview
                fields={orderLookupFields}
                screenKey="order-lookup"
                settings={settings}
                setSettings={setSettings}
                saveState={saveStateByScreen["order-lookup"] || "idle"}
                error={errorByScreen["order-lookup"] || ""}
                onDirty={() => setSaveStateByScreen((current) => ({ ...current, "order-lookup": "idle" }))}
                onSave={() => void save("order-lookup")}
              >
                <OrderLookupPreview settings={settings} />
              </ScreenEditorPreview>
            </PreviewShell>
          </div>
        </div>
      </div>
    </main>
  );
}

function PreviewShell({
  title,
  status,
  amber = false,
  danger = false,
  children,
}: {
  title: string;
  status: string;
  amber?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-[var(--admin-surface-muted)] sm:flex-row sm:items-center sm:justify-between sm:px-5"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">
            <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Vista usuario</span>
          </div>
          <h2 className="mt-1 text-xl font-semibold text-[var(--admin-text)]">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className={["w-fit rounded-full border px-3 py-1 text-xs font-semibold", danger ? "border-red-200 bg-red-50 text-red-700" : amber ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"].join(" ")}>
            {status}
          </span>
          <ChevronDown className={["h-5 w-5 shrink-0 text-[var(--admin-muted)] transition-transform", open ? "rotate-180" : ""].join(" ")} aria-hidden="true" />
        </div>
      </button>
      {open ? <div className="border-t border-[var(--admin-border)] p-4 sm:p-5">{children}</div> : null}
    </section>
  );
}

function ScreenEditorPreview({
  fields,
  screenKey,
  settings,
  setSettings,
  saveState,
  error,
  onDirty,
  onSave,
  children,
}: {
  fields: ScreenTextField[];
  screenKey: string;
  settings: ScreenTextSettings;
  setSettings: Dispatch<SetStateAction<ScreenTextSettings>>;
  saveState: SaveState;
  error: string;
  onDirty: () => void;
  onSave: () => void;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="rounded-2xl border border-[var(--admin-border)] bg-white/45 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-[var(--admin-text)]">Textos editables</h3>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">Estos campos modifican esta pantalla.</p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === "saving"}
            className="rounded-xl bg-[var(--admin-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--admin-primary-hover)] disabled:opacity-60"
          >
            {saveState === "saving" ? "Guardando..." : "Guardar"}
          </button>
        </div>

        {saveState === "saved" ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
            Cambios guardados.
          </div>
        ) : null}
        {saveState === "error" ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 space-y-4">
          {fields.map((field) => (
            <label key={`${screenKey}-${field.key}`} className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">{field.label}</span>
              {field.multiline ? (
                <textarea
                  value={settings[field.key]}
                  onChange={(event) => {
                    onDirty();
                    setSettings((current) => ({ ...current, [field.key]: event.target.value }));
                  }}
                  rows={3}
                  className="mt-2 w-full resize-y rounded-xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-3 py-2 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15"
                />
              ) : (
                <input
                  value={settings[field.key]}
                  onChange={(event) => {
                    onDirty();
                    setSettings((current) => ({ ...current, [field.key]: event.target.value }));
                  }}
                  className="mt-2 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-3 py-2 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15"
                />
              )}
            </label>
          ))}
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SuccessPreview({
  settings,
  subtotal,
  shipping,
  total,
}: {
  settings: ScreenTextSettings;
  subtotal: number;
  shipping: number;
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-[#E6D4C3] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-[#7A451C]">{settings.paymentSuccessTitle}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[#A97D58]">{settings.paymentSuccessSubtitle}</p>
            </div>
            <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              approved
            </span>
          </div>

          <OrderSummary subtotal={subtotal} shipping={shipping} total={total} />

          <div className="mt-3 text-xs text-[#A97D58]">{settings.paymentSuccessHint}</div>

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-xl bg-[#835321] px-4 py-2 text-sm font-semibold text-white">
              {settings.paymentSuccessBackToStoreButton}
            </span>
            <span className="rounded-xl border border-[#E6D4C3] px-4 py-2 text-sm font-semibold text-[#8B5A2B]">
              {settings.paymentSuccessViewOrderButton}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderCreatedPreview({ settings }: { settings: ScreenTextSettings }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-[#E6D4C3] bg-white p-5 shadow-sm sm:p-8">
          <h3 className="text-2xl font-semibold text-[#7A451C]">{settings.orderCreatedTitle}</h3>
          <p className="mt-2 text-sm text-[#A97D58]">
            {settings.orderCreatedNumberLabel}: <span className="font-mono font-semibold text-[#7A451C]">#1048</span>
          </p>

          <div className="mt-5 rounded-2xl border border-[#E6D4C3] bg-[#FFFDFB] p-4 text-sm sm:p-5">
            <div className="text-[#A97D58]">{settings.orderCreatedPaymentLabel}</div>
            <div className="mt-1 font-semibold text-[#7A451C]">Mercado Pago</div>
            <p className="mt-3 text-sm leading-6 text-[#A97D58]">{settings.orderCreatedMercadoPagoText}</p>
          </div>

          <button className="mt-5 w-full rounded-2xl bg-[#835321] px-4 py-3 text-sm font-semibold text-white" type="button">
            {settings.orderCreatedMercadoPagoButton}
          </button>

          <p className="mt-3 text-xs text-[#A97D58]">{settings.orderCreatedStockNote}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentPendingPreview({
  settings,
  subtotal,
  shipping,
  total,
}: {
  settings: ScreenTextSettings;
  subtotal: number;
  shipping: number;
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5]">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#E6D4C3] bg-white p-5 shadow-sm">
            <h3 className="text-xl font-semibold text-[#7A451C]">{settings.paymentPendingTitle}</h3>
            <p className="mt-2 text-sm leading-6 text-[#A97D58]">{settings.paymentPendingSubtitle}</p>
            <OrderSummary subtotal={subtotal} shipping={shipping} total={total} />
          </div>
          <div className="rounded-2xl border border-[#E6D4C3] bg-white p-5 shadow-sm">
            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 text-amber-600">
                  <Clock3 className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <div className="font-semibold">{settings.paymentPendingBoxTitle}</div>
                  <p className="mt-2 text-sm leading-6">{settings.paymentPendingInstructions}</p>
                </div>
              </div>
            </div>
            <button className="mt-5 w-full rounded-2xl bg-[#835321] px-4 py-3 text-sm font-semibold text-white" type="button">
              {settings.paymentPendingButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentFailurePreview({ settings }: { settings: ScreenTextSettings }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-[#E6D4C3] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-600">
            <XCircle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-2xl font-semibold text-[#7A451C]">{settings.paymentFailureTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-[#A97D58]">{settings.paymentFailureSubtitle}</p>
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {settings.paymentFailureHint}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-xl bg-[#835321] px-4 py-2 text-sm font-semibold text-white">
              {settings.paymentFailureBackToStoreButton}
            </span>
            <span className="rounded-xl border border-[#E6D4C3] px-4 py-2 text-sm font-semibold text-[#8B5A2B]">
              {settings.paymentFailureViewOrderButton}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ManualPaymentPreview({ settings }: { settings: ScreenTextSettings }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5]">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-[#E6D4C3] bg-white p-5 shadow-sm sm:p-8">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 text-amber-600">
                <Clock3 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <div className="text-lg font-semibold">{settings.manualPaymentTitle}</div>
                <p className="mt-1 text-sm">{settings.manualPaymentSubtitle} Orden #1048.</p>
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-[#E6D4C3] bg-[#FFFDFB] p-4">
            <h3 className="font-semibold text-[#7A451C]">{settings.manualPaymentInstructionsTitle}</h3>
            <div className="mt-4 space-y-1 text-sm leading-6 text-[#8B5A2B]">
              <p>Banco: Banco Demo</p>
              <p>Alias: FIKA.STORE</p>
              <p>CBU: 0000003100000000000001</p>
            </div>
          </div>
          <div className="mt-5 flex items-center gap-2 text-xs text-[#A97D58]">
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>{settings.manualPaymentEmailNote}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderLookupPreview({ settings }: { settings: ScreenTextSettings }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5]">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="rounded-2xl border border-[#E6D4C3] bg-white p-5 shadow-sm sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F4ECE4] text-[#8B5A2B]">
            <Search className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-2xl font-semibold text-[#7A451C]">{settings.orderLookupTitle}</h3>
          <p className="mt-2 text-sm leading-6 text-[#A97D58]">{settings.orderLookupSubtitle}</p>
          <div className="mt-6 space-y-4">
            <PreviewInput label={settings.orderLookupOrderLabel} value="#1048" />
            <PreviewInput label={settings.orderLookupEmailLabel} value="cliente@demo.com" />
          </div>
          <button className="mt-6 w-full rounded-2xl bg-[#835321] px-4 py-3 text-sm font-semibold text-white" type="button">
            {settings.orderLookupButton}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrderSummary({ subtotal, shipping, total }: { subtotal: number; shipping: number; total: number }) {
  return (
    <div className="mt-6 rounded-2xl border border-[#E6D4C3] bg-[#FFFDFB] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-[#A97D58]">
          Orden: <span className="font-mono font-semibold text-[#7A451C]">#1048</span>
        </div>
        <div className="text-sm text-[#A97D58]">
          Pago: <span className="font-semibold text-[#7A451C]">Mercado Pago</span>
        </div>
      </div>

      <div className="mt-5 space-y-3 border-t border-[#E6D4C3] pt-5">
        {exampleItems.map((item) => (
          <div key={item.name} className="flex min-w-0 items-start justify-between gap-3 text-sm">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F4ECE4] text-[#8B5A2B]">
                <ShoppingBag className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-[#7A451C]">{item.name}</div>
                <div className="mt-0.5 text-xs text-[#B08360]">{item.variant}</div>
                <div className="mt-1 text-xs text-[#B08360]">
                  {item.quantity} x {money(item.unitPrice)}
                </div>
              </div>
            </div>
            <div className="shrink-0 font-semibold text-[#7A451C]">{money(item.subtotal)}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2 border-t border-[#E6D4C3] pt-5 text-sm">
        <Row label="Subtotal" value={money(subtotal)} />
        <Row label="Envio" value={money(shipping)} />
        <div className="flex items-center justify-between pt-2 text-base text-[#7A451C]">
          <span>Total</span>
          <span className="text-xl font-bold">{money(total)}</span>
        </div>
      </div>
    </div>
  );
}

function PreviewInput({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#8B5A2B]">{label}</span>
      <span className="mt-2 block rounded-xl border border-[#E6D4C3] bg-[#FFFDFB] px-3 py-2 text-sm text-[#A97D58]">
        {value}
      </span>
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[#A97D58]">
      <span>{label}</span>
      <span className="font-semibold text-[#7A451C]">{value}</span>
    </div>
  );
}
