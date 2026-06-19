"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ImportResponse = {
  ok: boolean;
  error?: string;
  summary?: {
    totalRows: number;
    created: number;
    skipped: number;
    errors: number;
  };
  created?: Array<{ row: number; id: string; slug: string; name: string }>;
  skipped?: Array<{ row: number; slug?: string; reason: string }>;
  errors?: Array<{ row: number; slug?: string; reason: string }>;
};

export default function AdminProductsImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasResult = useMemo(() => Boolean(result?.summary), [result]);

  async function submit() {
    setError(null);
    setResult(null);

    if (!file) {
      setError("Seleccioná un archivo .xlsx antes de importar.");
      return;
    }

    setLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/products/import", {
      method: "POST",
      body: fd,
    });

    const data = (await res.json().catch(() => ({}))) as ImportResponse;
    setLoading(false);

    if (!res.ok) {
      setResult(data);
      setError(data?.error || "No se pudo importar el archivo.");
      return;
    }

    setResult(data);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Importar productos (XLSX)</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Carga masiva para staff (`admin` y `merchant`).
            </p>
          </div>

          <Link
            href="/admin/products"
            className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
          >
            Volver a productos
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-sm font-semibold text-zinc-200">Formato esperado</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Encabezados recomendados: <span className="font-mono">name</span>, <span className="font-mono">slug</span>,{" "}
            <span className="font-mono">category</span>, <span className="font-mono">description</span>, <span className="font-mono">price</span>,{" "}
            <span className="font-mono">stock</span>, <span className="font-mono">isActive</span>.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            `slug` es opcional (si falta, se genera desde `name`). `isActive` acepta: true/false, si/no, 1/0.
            `category` es opcional; si no existe, se crea.
          </p>
          <p className="mt-1 text-xs text-zinc-500">Máximo 1000 filas por archivo.</p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />

            <button
              onClick={submit}
              disabled={loading}
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Importando..." : "Importar"}
            </button>
          </div>

          {file && <p className="mt-2 text-xs text-zinc-500">Archivo: {file.name}</p>}
          {error && <p className="mt-3 text-sm text-amber-300">{error}</p>}
        </div>

        {hasResult && (
          <div className="mt-6 space-y-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard label="Filas" value={result?.summary?.totalRows ?? 0} />
              <StatCard label="Creados" value={result?.summary?.created ?? 0} />
              <StatCard label="Omitidos" value={result?.summary?.skipped ?? 0} />
              <StatCard label="Errores" value={result?.summary?.errors ?? 0} />
            </div>

            <ResultTable
              title="Productos creados"
              rows={(result?.created ?? []).map((x) => ({
                row: x.row,
                slug: x.slug,
                reason: x.name,
              }))}
              empty="No se crearon productos."
            />

            <ResultTable
              title="Filas omitidas"
              rows={result?.skipped ?? []}
              empty="No hubo filas omitidas."
            />

            <ResultTable title="Errores" rows={result?.errors ?? []} empty="No hubo errores." />
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ResultTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: Array<{ row: number; slug?: string; reason: string }>;
  empty: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800">
      <div className="border-b border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm font-semibold">{title}</div>

      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-zinc-400">{empty}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-zinc-900/20">
              <tr className="text-left text-xs text-zinc-400">
                <th className="px-4 py-2">Fila</th>
                <th className="px-4 py-2">Slug</th>
                <th className="px-4 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950/20 text-sm">
              {rows.map((r, i) => (
                <tr key={`${title}-${r.row}-${r.slug || "no-slug"}-${i}`}>
                  <td className="px-4 py-2">{r.row}</td>
                  <td className="px-4 py-2 font-mono text-xs text-zinc-400">{r.slug || "-"}</td>
                  <td className="px-4 py-2">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
