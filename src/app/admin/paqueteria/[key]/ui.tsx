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
}: {
  providerKey: ShippingCarrierKey;
  providerName: string;
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
      </div>
    </main>
  );
}
