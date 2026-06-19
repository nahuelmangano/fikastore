"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type ProductOption = {
  id: string;
  name: string;
  slug: string;
  price: number;
  isActive: boolean;
  stock: number;
};

type Promotion = {
  id: string;
  name: string;
  type: "global" | "product" | "code";
  percent: number;
  code: string | null;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  products: { id: string; name: string; slug: string }[];
  createdAt: string;
};

type FormState = {
  name: string;
  percent: number;
  startsAt: string;
  endsAt: string;
};

const emptyForm: FormState = {
  name: "",
  percent: 10,
  startsAt: "",
  endsAt: "",
};

function formatDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-AR");
}

export default function AdminPromotions({ products }: { products: ProductOption[] }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [globalForm, setGlobalForm] = useState<FormState>(emptyForm);
  const [productForm, setProductForm] = useState<FormState>(emptyForm);
  const [codeForm, setCodeForm] = useState<FormState>(emptyForm);
  const [promoCode, setPromoCode] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<"global" | "product" | "code" | null>(null);

  async function refreshPromotions() {
    setLoadingList(true);
    const res = await fetch("/api/admin/promotions");
    const data = await res.json().catch(() => ({}));
    setLoadingList(false);
    if (!res.ok) {
      setError(data?.error || "No se pudieron cargar promociones.");
      return;
    }
    setPromotions(data.promotions || []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      const res = await fetch("/api/admin/promotions");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setLoadingList(false);
      if (!res.ok) {
        setError(data?.error || "No se pudieron cargar promociones.");
        return;
      }
      setPromotions(data.promotions || []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function createPromotion(payload: Record<string, unknown>, key: "global" | "product" | "code") {
    setError(null);
    setMsg(null);
    setSubmitting(key);
    const res = await fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSubmitting(null);
    if (!res.ok) {
      setError(data?.error || "No se pudo crear la promoción.");
      return;
    }
    setPromotions((prev) => [data.promotion, ...prev]);
    setMsg(`Promoción creada: ${data?.promotion?.name || ""}`);
  }

  async function togglePromotion(id: string, isActive: boolean) {
    setError(null);
    const res = await fetch(`/api/admin/promotions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "No se pudo actualizar.");
      return;
    }
    setPromotions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isActive: data.promotion.isActive } : p))
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · Promociones</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Configurá descuentos globales, por producto y códigos promocionales.
            </p>
          </div>
          <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver
          </Link>
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <form
            className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await createPromotion(
                {
                  name: globalForm.name,
                  type: "global",
                  percent: globalForm.percent,
                  startsAt: globalForm.startsAt || null,
                  endsAt: globalForm.endsAt || null,
                },
                "global"
              );
              setGlobalForm(emptyForm);
            }}
          >
            <h2 className="text-base font-semibold">Descuento general</h2>
            <p className="mt-1 text-xs text-zinc-400">Aplica a toda la tienda.</p>
            <Input
              label="Nombre"
              value={globalForm.name}
              onChange={(v) => setGlobalForm((s) => ({ ...s, name: v }))}
              required
            />
            <Input
              label="Porcentaje"
              type="number"
              min={1}
              max={99}
              value={String(globalForm.percent)}
              onChange={(v) => setGlobalForm((s) => ({ ...s, percent: Number(v || 0) }))}
              required
            />
            <DateFields state={globalForm} onChange={setGlobalForm} />
            <button
              disabled={submitting === "global"}
              className="mt-4 w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {submitting === "global" ? "Creando..." : "Crear descuento global"}
            </button>
          </form>

          <form
            className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await createPromotion(
                {
                  name: productForm.name,
                  type: "product",
                  percent: productForm.percent,
                  productIds: selectedProducts,
                  startsAt: productForm.startsAt || null,
                  endsAt: productForm.endsAt || null,
                },
                "product"
              );
              setProductForm(emptyForm);
              setSelectedProducts([]);
            }}
          >
            <h2 className="text-base font-semibold">Descuento por producto</h2>
            <p className="mt-1 text-xs text-zinc-400">Podés seleccionar uno o varios productos.</p>
            <Input
              label="Nombre"
              value={productForm.name}
              onChange={(v) => setProductForm((s) => ({ ...s, name: v }))}
              required
            />
            <Input
              label="Porcentaje"
              type="number"
              min={1}
              max={99}
              value={String(productForm.percent)}
              onChange={(v) => setProductForm((s) => ({ ...s, percent: Number(v || 0) }))}
              required
            />
            <DateFields state={productForm} onChange={setProductForm} />
            <div className="mt-3 max-h-40 overflow-auto rounded-xl border border-zinc-800 p-2">
              {products.map((p) => {
                const checked = selectedProducts.includes(p.id);
                return (
                  <label key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-zinc-900/60">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        setSelectedProducts((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                        );
                      }}
                    />
                    <span className="truncate">{p.name}</span>
                    <span className="ml-auto text-xs text-zinc-500">${p.price.toLocaleString("es-AR")}</span>
                  </label>
                );
              })}
            </div>
            <button
              disabled={submitting === "product"}
              className="mt-4 w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {submitting === "product" ? "Creando..." : "Crear descuento por producto"}
            </button>
          </form>

          <form
            className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
            onSubmit={async (e) => {
              e.preventDefault();
              await createPromotion(
                {
                  name: codeForm.name,
                  type: "code",
                  percent: codeForm.percent,
                  code: promoCode,
                  startsAt: codeForm.startsAt || null,
                  endsAt: codeForm.endsAt || null,
                },
                "code"
              );
              setCodeForm(emptyForm);
              setPromoCode("");
            }}
          >
            <h2 className="text-base font-semibold">Código promocional</h2>
            <p className="mt-1 text-xs text-zinc-400">El usuario lo ingresa en el carrito.</p>
            <Input
              label="Nombre"
              value={codeForm.name}
              onChange={(v) => setCodeForm((s) => ({ ...s, name: v }))}
              required
            />
            <Input
              label="Código"
              value={promoCode}
              onChange={setPromoCode}
              required
            />
            <Input
              label="Porcentaje"
              type="number"
              min={1}
              max={99}
              value={String(codeForm.percent)}
              onChange={(v) => setCodeForm((s) => ({ ...s, percent: Number(v || 0) }))}
              required
            />
            <DateFields state={codeForm} onChange={setCodeForm} />
            <button
              disabled={submitting === "code"}
              className="mt-4 w-full rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {submitting === "code" ? "Creando..." : "Crear código"}
            </button>
          </form>
        </section>

        {msg && <div className="mt-4 rounded-xl border border-emerald-700/40 bg-emerald-50 p-3 text-sm text-emerald-900">{msg}</div>}
        {error && <div className="mt-4 rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}

        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Promociones cargadas</h2>
            <button
              onClick={refreshPromotions}
              className="rounded-xl border border-zinc-800 px-3 py-1.5 text-xs hover:bg-zinc-900/60"
            >
              Refrescar
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-zinc-900/40">
                  <tr className="text-left text-xs text-zinc-400">
                    <th className="px-4 py-3">Promoción</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Descuento</th>
                    <th className="px-4 py-3">Vigencia</th>
                    <th className="px-4 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-950/20">
                  {!loadingList &&
                    promotions.map((p) => (
                      <tr key={p.id} className="text-sm">
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.name}</div>
                          {p.code && <div className="mt-1 font-mono text-xs text-zinc-400">{p.code}</div>}
                          {p.type === "product" && p.products.length > 0 && (
                            <div className="mt-1 text-xs text-zinc-500">
                              {p.products.slice(0, 3).map((x) => x.name).join(" · ")}
                              {p.products.length > 3 ? "…" : ""}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">{p.type}</td>
                        <td className="px-4 py-3">{p.percent}%</td>
                        <td className="px-4 py-3 text-zinc-400">
                          {formatDate(p.startsAt)} → {formatDate(p.endsAt)}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => togglePromotion(p.id, p.isActive)}
                            className={[
                              "rounded-full border px-2 py-0.5 text-xs",
                              p.isActive
                                ? "border-amber-700/40 bg-amber-50 text-amber-900"
                                : "border-zinc-800 bg-zinc-900/40 text-zinc-300",
                            ].join(" ")}
                          >
                            {p.isActive ? "Activa" : "Inactiva"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  {!loadingList && promotions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                        No hay promociones.
                      </td>
                    </tr>
                  )}
                  {loadingList && (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-sm text-zinc-400">
                        Cargando promociones...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <div className="mt-3">
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
      />
    </div>
  );
}

function DateFields({
  state,
  onChange,
}: {
  state: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
}) {
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <div>
        <label className="text-xs text-zinc-400">Inicio (opcional)</label>
        <input
          type="datetime-local"
          value={state.startsAt}
          onChange={(e) => onChange((s) => ({ ...s, startsAt: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-zinc-400">Fin (opcional)</label>
        <input
          type="datetime-local"
          value={state.endsAt}
          onChange={(e) => onChange((s) => ({ ...s, endsAt: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
