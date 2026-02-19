"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Carrier = {
  key: string;
  name: string;
  enabled: boolean;
};

export default function AdminPaqueteria({ carriers }: { carriers: Carrier[] }) {
  const [items, setItems] = useState<Carrier[]>(carriers);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const enabledCount = useMemo(() => items.filter((c) => c.enabled).length, [items]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · Paquetería</h1>
            <p className="mt-1 text-sm text-zinc-400">{enabledCount} habilitado(s)</p>
          </div>
          <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver
          </Link>
        </div>

        <div className="mt-6 grid gap-4">
          {items.map((c) => {
            const busy = loadingKey === c.key;
            return (
              <div
                key={c.key}
                className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="text-sm text-zinc-400">Proveedor</div>
                    <div className="mt-1 text-lg font-semibold">{c.name}</div>
                    <div className="mt-1 text-xs font-mono text-zinc-500">{c.key}</div>
                  </div>

                  <button
                    disabled={busy}
                    onClick={async () => {
                      setMsg(null);
                      setLoadingKey(c.key);
                      const next = !c.enabled;

                      const res = await fetch("/api/admin/shipping/carriers", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ key: c.key, enabled: next }),
                      });
                      const data = await res.json().catch(() => ({}));
                      setLoadingKey(null);

                      if (!res.ok) {
                        setMsg(data?.error || "No se pudo actualizar.");
                        return;
                      }

                      setItems((prev) =>
                        prev.map((it) => (it.key === c.key ? { ...it, enabled: next } : it))
                      );
                    }}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      c.enabled
                        ? "bg-emerald-200 text-emerald-950 hover:bg-emerald-100"
                        : "bg-zinc-100 text-zinc-900 hover:bg-white"
                    } disabled:opacity-60`}
                  >
                    {busy ? "Actualizando..." : c.enabled ? "Habilitado" : "Deshabilitado"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {msg && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
            {msg}
          </div>
        )}
      </div>
    </main>
  );
}
