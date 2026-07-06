"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ShippingCarrierKey } from "@/lib/shippingCarriers";

type Field = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
  value: string;
};

export default function AdminCarrierConfig({
  providerKey,
  providerName,
  canCreateTestShipments,
}: {
  providerKey: ShippingCarrierKey;
  providerName: string;
  canCreateTestShipments: boolean;
}) {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/shipping/providers/${providerKey}/config`);
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(data?.error || "No se pudo cargar configuración.");
        return;
      }
      setFields(data?.fields || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [providerKey]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-zinc-400">Cargando configuración...</div>
      </main>
    );
  }

  if (fields.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold tracking-tight">Admin · {providerName}</h1>
            <Link href="/admin/paqueteria" className="text-sm text-zinc-400 hover:text-zinc-200">
              Volver
            </Link>
          </div>
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 text-sm text-zinc-300">
            Este proveedor no requiere configuración adicional.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · {providerName}</h1>
            <p className="mt-1 text-sm text-zinc-400">Completá los datos para operar este proveedor.</p>
          </div>
          <Link href="/admin/paqueteria" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver
          </Link>
        </div>

        <form
          className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setMsg(null);
            setSaving(true);
            const values = Object.fromEntries(fields.map((f) => [f.key, f.value]));
            const res = await fetch(`/api/admin/shipping/providers/${providerKey}/config`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ values }),
            });
            const data = await res.json().catch(() => ({}));
            setSaving(false);
            if (!res.ok) {
              setError(data?.error || "No se pudo guardar.");
              return;
            }
            setFields(data?.fields || fields);
            setMsg("Configuración guardada.");
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map((field) => (
              <div key={field.key}>
                <label className="text-xs text-zinc-400">
                  {field.label}
                  {field.required && <span className="ml-1 text-amber-300">*</span>}
                </label>
                <input
                  type={field.secret ? "password" : "text"}
                  value={field.value || ""}
                  placeholder={field.placeholder || ""}
                  onChange={(e) =>
                    setFields((prev) =>
                      prev.map((f) => (f.key === field.key ? { ...f, value: e.target.value } : f))
                    )
                  }
                  className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                />
                <div className="mt-1 font-mono text-[11px] text-zinc-500">{field.key}</div>
              </div>
            ))}
          </div>

          {msg && <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">{msg}</div>}
          {error && <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}

          <div className="mt-5 flex justify-end">
            <button
              disabled={saving}
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar configuración"}
            </button>
          </div>
        </form>

        {(providerKey === "correo" || providerKey === "epick") && canCreateTestShipments && (
          <TestShipmentPanel providerKey={providerKey} providerName={providerName} />
        )}
      </div>
    </main>
  );
}

type TestShipmentResult = {
  ok?: boolean;
  error?: string;
  details?: string;
  order?: {
    id?: string;
    orderNumber?: number;
  };
  shipment?: {
    id?: string;
    shippingId?: string | null;
    epickOrderId?: string | null;
    senderCode?: string | null;
    status?: string;
  };
  response?: unknown;
};

const ARGENTINA_PROVINCES = [
  { name: "Ciudad Autónoma de Buenos Aires", code: "C" },
  { name: "Buenos Aires", code: "B" },
  { name: "Catamarca", code: "K" },
  { name: "Chaco", code: "H" },
  { name: "Chubut", code: "U" },
  { name: "Córdoba", code: "X" },
  { name: "Corrientes", code: "W" },
  { name: "Entre Ríos", code: "E" },
  { name: "Formosa", code: "P" },
  { name: "Jujuy", code: "Y" },
  { name: "La Pampa", code: "L" },
  { name: "La Rioja", code: "F" },
  { name: "Mendoza", code: "M" },
  { name: "Misiones", code: "N" },
  { name: "Neuquén", code: "Q" },
  { name: "Río Negro", code: "R" },
  { name: "Salta", code: "A" },
  { name: "San Juan", code: "J" },
  { name: "San Luis", code: "D" },
  { name: "Santa Cruz", code: "Z" },
  { name: "Santa Fe", code: "S" },
  { name: "Santiago del Estero", code: "G" },
  { name: "Tierra del Fuego", code: "V" },
  { name: "Tucumán", code: "T" },
];

function TestShipmentPanel({
  providerKey,
  providerName,
}: {
  providerKey: "correo" | "epick";
  providerName: string;
}) {
  const [form, setForm] = useState({
    name: "Destinatario Prueba",
    phone: "1100000000",
    email: "",
    streetName: "Av Siempre Viva",
    streetNumber: "742",
    city: "CABA",
    province: "Ciudad Autónoma de Buenos Aires",
    zip: "1000",
    declaredValue: "1000",
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestShipmentResult | null>(null);

  const update = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isCorreo = providerKey === "correo";
  const shipmentId = isCorreo ? result?.shipment?.shippingId : result?.shipment?.epickOrderId;

  return (
    <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Probar creación de envío</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Crea una orden interna pagada y la envía a {providerName} usando la configuración guardada.
          </p>
        </div>
        {result?.order?.id && (
          <Link
            href={`/admin/orders/${result.order.id}`}
            className="rounded-xl border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
          >
            Ver orden
          </Link>
        )}
      </div>

      <form
        className="mt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setResult(null);

          const res = await fetch(`/api/admin/shipping/${providerKey}/test-shipment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              addressLine: `${form.streetName} ${form.streetNumber}`.trim(),
              provinceCode: ARGENTINA_PROVINCES.find((p) => p.name === form.province)?.code || "",
            }),
          });
          const data = await res.json().catch(() => ({}));
          setLoading(false);
          setResult(data);
        }}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <TextInput label="Nombre destinatario" value={form.name} onChange={(v) => update("name", v)} />
          <TextInput label="Teléfono" value={form.phone} onChange={(v) => update("phone", v)} />
          <TextInput label="Email destinatario" value={form.email} onChange={(v) => update("email", v)} />
          <TextInput label="Calle" value={form.streetName} onChange={(v) => update("streetName", v)} />
          <TextInput label="Altura" value={form.streetNumber} onChange={(v) => update("streetNumber", v)} />
          <TextInput label="Ciudad" value={form.city} onChange={(v) => update("city", v)} />
          <ProvinceSelect value={form.province} onChange={(v) => update("province", v)} />
          <TextInput label="Código postal" value={form.zip} onChange={(v) => update("zip", v)} />
          <TextInput label="Valor declarado" value={form.declaredValue} onChange={(v) => update("declaredValue", v)} />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            disabled={loading}
            className="rounded-xl bg-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
          >
            {loading ? "Creando envío..." : "Crear envío de prueba"}
          </button>
        </div>
      </form>

      {result && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            result.ok
              ? "border-emerald-700/40 bg-emerald-950/40 text-emerald-100"
              : "border-amber-700/40 bg-amber-50 text-amber-900"
          }`}
        >
          {result.ok ? (
            <div className="space-y-1">
              <div>Envío creado correctamente.</div>
              <div className="font-mono text-xs">
                Orden #{result.order?.orderNumber ?? "—"} · {isCorreo ? "ShippingId" : "EpickOrderId"}:{" "}
                {shipmentId || "sin id"}
              </div>
              {!isCorreo && result.shipment?.senderCode && (
                <div className="font-mono text-xs">Sender code: {result.shipment.senderCode}</div>
              )}
              <div className="font-mono text-xs">Estado: {result.shipment?.status || "—"}</div>
            </div>
          ) : (
            <div className="space-y-1">
              <div>{result.error || "No se pudo crear el envío."}</div>
              {result.details && <div className="font-mono text-xs">{result.details}</div>}
              {result.order?.id && (
                <div className="font-mono text-xs">Orden de prueba creada: #{result.order.orderNumber ?? result.order.id}</div>
              )}
            </div>
          )}

          {result.response ? (
            <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-zinc-950/70 p-3 text-xs text-zinc-100">
              {JSON.stringify(result.response, null, 2)}
            </pre>
          ) : null}
        </div>
      )}
    </section>
  );
}

function ProvinceSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-zinc-400">
      Provincia
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      >
        {ARGENTINA_PROVINCES.map((province) => (
          <option key={province.code} value={province.name}>
            {province.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-xs text-zinc-400">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      />
    </label>
  );
}
