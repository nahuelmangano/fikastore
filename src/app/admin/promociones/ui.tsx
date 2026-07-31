"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  Clipboard,
  Copy,
  PackageSearch,
  Plus,
  Search,
  Sparkles,
  Tag,
  TicketPercent,
  XCircle,
  type LucideIcon,
} from "lucide-react";

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

type ActiveTab = "global" | "product" | "code";

const emptyForm: FormState = {
  name: "",
  percent: 10,
  startsAt: "",
  endsAt: "",
};

const tabs: { key: ActiveTab; label: string; icon: LucideIcon }[] = [
  { key: "global", label: "Descuento general", icon: Sparkles },
  { key: "product", label: "Por producto", icon: PackageSearch },
  { key: "code", label: "Código promocional", icon: TicketPercent },
];

function formatDate(v: string | null) {
  if (!v) return "Sin fecha";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPromotionStatus(p: Promotion) {
  const now = Date.now();
  const startsAt = p.startsAt ? new Date(p.startsAt).getTime() : null;
  const endsAt = p.endsAt ? new Date(p.endsAt).getTime() : null;

  if (!p.isActive) return "inactive";
  if (startsAt && startsAt > now) return "scheduled";
  if (endsAt && endsAt < now) return "expired";
  return "active";
}

function statusMeta(status: ReturnType<typeof getPromotionStatus>) {
  if (status === "active") return { label: "Activa", className: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  if (status === "scheduled") return { label: "Programada", className: "border-sky-200 bg-sky-50 text-sky-800" };
  if (status === "expired") return { label: "Vencida", className: "border-zinc-200 bg-zinc-50 text-zinc-600" };
  return { label: "Inactiva", className: "border-[#E5D7C8] bg-[#FAF8F5] text-[#8F6A49]" };
}

function promotionTypeLabel(type: Promotion["type"]) {
  if (type === "global") return "General";
  if (type === "product") return "Por producto";
  return "Código";
}

function generateCode() {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FIKA${suffix}`;
}

function validateForm(tab: ActiveTab, form: FormState, promoCode: string, selectedProducts: string[]) {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("El nombre es obligatorio.");
  if (!Number.isFinite(form.percent) || form.percent < 1 || form.percent > 99) {
    errors.push("El porcentaje debe estar entre 1 y 99.");
  }
  if (tab === "code" && !promoCode.trim()) errors.push("El código promocional es obligatorio.");
  if (tab === "product" && selectedProducts.length === 0) errors.push("Seleccioná al menos un producto.");
  if (form.startsAt && form.endsAt && new Date(form.startsAt) > new Date(form.endsAt)) {
    errors.push("La fecha de inicio no puede ser posterior a la fecha de fin.");
  }
  return errors;
}

export default function AdminPromotions({ products }: { products: ProductOption[] }) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("global");
  const [productSearch, setProductSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [globalForm, setGlobalForm] = useState<FormState>(emptyForm);
  const [productForm, setProductForm] = useState<FormState>(emptyForm);
  const [codeForm, setCodeForm] = useState<FormState>(emptyForm);
  const [promoCode, setPromoCode] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<ActiveTab | null>(null);

  const activeForm = activeTab === "global" ? globalForm : activeTab === "product" ? productForm : codeForm;
  const activeErrors = validateForm(activeTab, activeForm, promoCode, selectedProducts);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.slug}`.toLowerCase().includes(q));
  }, [productSearch, products]);

  const stats = useMemo(() => {
    const statuses = promotions.map(getPromotionStatus);
    return {
      active: statuses.filter((s) => s === "active").length,
      scheduled: statuses.filter((s) => s === "scheduled").length,
      expired: statuses.filter((s) => s === "expired").length,
      codes: promotions.filter((p) => p.type === "code").length,
    };
  }, [promotions]);

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

  async function copyCode(code: string) {
    await navigator.clipboard?.writeText(code).catch(() => null);
    setCopiedCode(code);
    window.setTimeout(() => setCopiedCode(null), 1600);
  }

  async function createPromotion(payload: Record<string, unknown>, key: ActiveTab) {
    const visualErrors = validateForm(key, key === "global" ? globalForm : key === "product" ? productForm : codeForm, promoCode, selectedProducts);
    if (visualErrors.length > 0) {
      setError(visualErrors[0]);
      setMsg(null);
      return;
    }

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

  async function submitActiveForm() {
    if (activeTab === "global") {
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
      if (validateForm("global", globalForm, promoCode, selectedProducts).length === 0) setGlobalForm(emptyForm);
    }

    if (activeTab === "product") {
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
      if (validateForm("product", productForm, promoCode, selectedProducts).length === 0) {
        setProductForm(emptyForm);
        setSelectedProducts([]);
      }
    }

    if (activeTab === "code") {
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
      if (validateForm("code", codeForm, promoCode, selectedProducts).length === 0) {
        setCodeForm(emptyForm);
        setPromoCode("");
      }
    }
  }

  return (
    <main className="min-h-screen bg-[#FAF8F5] text-[#70471F]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#A37A55]">Admin · Promociones</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#5F3B18]">
              Gestión de promociones
            </h1>
            <p className="mt-2 max-w-2xl text-base text-[#8F6A49]">
              Creá descuentos para impulsar ventas, liquidaciones y campañas.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-2.5 xl:py-2 text-sm font-semibold text-[#8B5A2B] shadow-sm transition duration-150 hover:bg-[#F2ECE5]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver
          </Link>
        </header>

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={CheckCircle2} label="Promociones activas" value={stats.active} />
          <StatCard icon={CalendarClock} label="Programadas" value={stats.scheduled} />
          <StatCard icon={XCircle} label="Vencidas" value={stats.expired} />
          <StatCard icon={TicketPercent} label="Códigos promocionales" value={stats.codes} />
        </section>

        <section className="mt-8 xl:mt-6 rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
          <div className="flex gap-2 overflow-x-auto border-b border-[#E5D7C8] pb-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setError(null);
                    setMsg(null);
                  }}
                  className={[
                    "inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 xl:py-2 text-sm font-semibold transition duration-150",
                    active
                      ? "bg-[#8B5A2B] text-white shadow-sm"
                      : "border border-[#E5D7C8] text-[#7B522E] hover:bg-[#F2ECE5]",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="mt-6 xl:mt-4 grid gap-6 xl:gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await submitActiveForm();
              }}
              className="space-y-5"
            >
              {activeTab === "global" ? (
                <PromotionFields
                  form={globalForm}
                  onChange={setGlobalForm}
                  help={[
                    "Aplica a toda la tienda.",
                    "Si no indicás fecha de inicio, queda activo inmediatamente.",
                    "Si no indicás fecha de fin, no vence automáticamente.",
                  ]}
                />
              ) : null}

              {activeTab === "product" ? (
                <>
                  <PromotionFields
                    form={productForm}
                    onChange={setProductForm}
                    help={[
                      "Seleccioná uno o varios productos para limitar el descuento.",
                      "Si no indicás fecha de inicio, queda activo inmediatamente.",
                      "Si no indicás fecha de fin, no vence automáticamente.",
                    ]}
                  />
                  <ProductPicker
                    products={filteredProducts}
                    totalProducts={products.length}
                    selectedProducts={selectedProducts}
                    search={productSearch}
                    onSearch={setProductSearch}
                    onToggle={(id, checked) => {
                      setSelectedProducts((prev) =>
                        checked ? [...prev, id] : prev.filter((productId) => productId !== id)
                      );
                    }}
                  />
                </>
              ) : null}

              {activeTab === "code" ? (
                <>
                  <PromotionFields
                    form={codeForm}
                    onChange={setCodeForm}
                    help={[
                      "El cliente ingresa este código en el carrito.",
                      "Si no indicás fecha de inicio, queda activo inmediatamente.",
                      "Si no indicás fecha de fin, no vence automáticamente.",
                    ]}
                  />
                  <div>
                    <label className="text-sm font-semibold text-[#70471F]">Código</label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        placeholder="FIKA10"
                        className="w-full rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-3 xl:py-2.5 font-mono text-sm text-[#5F3B18] outline-none transition duration-150 focus:border-[#8B5A2B]"
                      />
                      <button
                        type="button"
                        onClick={() => setPromoCode(generateCode())}
                        className="rounded-2xl border border-[#E5D7C8] px-4 py-3 xl:py-2.5 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5]"
                      >
                        Generar
                      </button>
                      <button
                        type="button"
                        onClick={() => promoCode && copyCode(promoCode)}
                        disabled={!promoCode}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#E5D7C8] px-4 py-3 xl:py-2.5 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Copy className="h-4 w-4" aria-hidden="true" />
                        Copiar
                      </button>
                    </div>
                  </div>
                </>
              ) : null}

              {activeErrors.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 xl:py-2.5 text-sm text-amber-900">
                  {activeErrors[0]}
                </div>
              ) : null}

              <button
                disabled={submitting === activeTab}
                className="w-full rounded-2xl bg-[#8B5A2B] px-5 py-3 xl:py-2.5 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#70471F] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {submitting === activeTab
                  ? "Creando..."
                  : activeTab === "global"
                    ? "Crear descuento general"
                    : activeTab === "product"
                      ? "Crear descuento por producto"
                      : "Crear código promocional"}
              </button>
            </form>

            <div className="space-y-4">
              <PreviewBox
                tab={activeTab}
                form={activeForm}
                promoCode={promoCode}
                selectedCount={selectedProducts.length}
              />
              {msg ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 xl:py-2.5 text-sm text-emerald-900">
                  {msg}
                </div>
              ) : null}
              {error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 xl:py-2.5 text-sm text-amber-900">
                  {error}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mt-8 xl:mt-6 rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#5F3B18]">Promociones cargadas</h2>
              <p className="mt-1 text-sm text-[#8F6A49]">Gestioná el estado de tus campañas actuales.</p>
            </div>
            <button
              onClick={refreshPromotions}
              className="rounded-2xl border border-[#E5D7C8] px-4 py-2 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5]"
            >
              Refrescar
            </button>
          </div>

          {loadingList ? (
            <EmptyState icon={BadgePercent} title="Cargando promociones..." description="Estamos buscando las campañas guardadas." />
          ) : promotions.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="Todavía no creaste promociones."
              description="Creá descuentos para impulsar ventas o campañas especiales."
              action={
                <button
                  type="button"
                  onClick={() => setActiveTab("global")}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Crear primera promoción
                </button>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#E5D7C8]">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead className="bg-[#F6F0EA] text-xs font-semibold uppercase tracking-wide text-[#A37A55]">
                    <tr>
                      <th className="px-4 py-3 xl:py-2.5">Promoción</th>
                      <th className="px-4 py-3 xl:py-2.5">Tipo</th>
                      <th className="px-4 py-3 xl:py-2.5">Descuento</th>
                      <th className="px-4 py-3 xl:py-2.5">Vigencia</th>
                      <th className="px-4 py-3 xl:py-2.5">Estado</th>
                      <th className="px-4 py-3 xl:py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5D7C8] bg-white/45">
                    {promotions.map((p) => {
                      const status = statusMeta(getPromotionStatus(p));
                      return (
                        <tr key={p.id} className="text-sm transition duration-150 hover:bg-[#F2ECE5]">
                          <td className="px-4 py-4 xl:py-2.5">
                            <div className="font-semibold text-[#5F3B18]">{p.name}</div>
                            {p.code ? <div className="mt-1 font-mono text-xs text-[#A37A55]">{p.code}</div> : null}
                            {p.type === "product" && p.products.length > 0 ? (
                              <div className="mt-1 max-w-sm truncate text-xs text-[#8F6A49]">
                                {p.products.slice(0, 3).map((x) => x.name).join(" · ")}
                                {p.products.length > 3 ? "…" : ""}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-4 xl:py-2.5 text-[#70471F]">{promotionTypeLabel(p.type)}</td>
                          <td className="px-4 py-4 xl:py-2.5 font-semibold text-[#5F3B18]">{p.percent}%</td>
                          <td className="px-4 py-4 xl:py-2.5 text-[#8F6A49]">
                            <div>{formatDate(p.startsAt)}</div>
                            <div className="mt-1 text-xs">hasta {formatDate(p.endsAt)}</div>
                          </td>
                          <td className="px-4 py-4 xl:py-2.5">
                            <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", status.className].join(" ")}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 xl:py-2.5">
                            <div className="flex justify-end gap-2">
                              {p.code ? (
                                <button
                                  type="button"
                                  onClick={() => copyCode(p.code || "")}
                                  className="inline-flex items-center gap-1 rounded-xl border border-[#E5D7C8] px-3 py-1.5 text-xs font-semibold text-[#8B5A2B] hover:bg-[#F2ECE5]"
                                >
                                  <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                                  {copiedCode === p.code ? "Copiado" : "Copiar"}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => togglePromotion(p.id, p.isActive)}
                                className="rounded-xl border border-[#E5D7C8] px-3 py-1.5 text-xs font-semibold text-[#8B5A2B] hover:bg-[#F2ECE5]"
                              >
                                {p.isActive ? "Desactivar" : "Activar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-[#A37A55]">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-[#5F3B18]">{value}</div>
        </div>
        <div className="rounded-2xl bg-[#F2ECE5] p-3 text-[#8B5A2B]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function PromotionFields({
  form,
  onChange,
  help,
}: {
  form: FormState;
  onChange: (updater: (prev: FormState) => FormState) => void;
  help: string[];
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Nombre"
          value={form.name}
          onChange={(v) => onChange((s) => ({ ...s, name: v }))}
          placeholder="Liquidación invierno"
        />
        <Input
          label="Porcentaje"
          type="number"
          min={1}
          max={99}
          value={String(form.percent)}
          onChange={(v) => onChange((s) => ({ ...s, percent: Number(v || 0) }))}
          placeholder="10"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <DateInput
          label="Activo desde"
          value={form.startsAt}
          onChange={(v) => onChange((s) => ({ ...s, startsAt: v }))}
        />
        <DateInput
          label="Activo hasta"
          value={form.endsAt}
          onChange={(v) => onChange((s) => ({ ...s, endsAt: v }))}
        />
      </div>
      <div className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-3 xl:py-2.5 text-sm text-[#8F6A49]">
        {help.map((line) => (
          <div key={line}>• {line}</div>
        ))}
      </div>
    </>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#70471F]">{label}</span>
      <input
        type={type}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none transition duration-150 placeholder:text-[#B18B68] focus:border-[#8B5A2B]"
      />
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#70471F]">{label}</span>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none transition duration-150 focus:border-[#8B5A2B]"
      />
    </label>
  );
}

function ProductPicker({
  products,
  totalProducts,
  selectedProducts,
  search,
  onSearch,
  onToggle,
}: {
  products: ProductOption[];
  totalProducts: number;
  selectedProducts: string[];
  search: string;
  onSearch: (v: string) => void;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="text-sm font-semibold text-[#70471F]">Productos seleccionados</label>
          <p className="mt-1 text-sm text-[#8F6A49]">{selectedProducts.length} de {totalProducts} productos</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#B18B68]" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] py-3 xl:py-2.5 pl-10 pr-4 text-sm text-[#5F3B18] outline-none transition duration-150 focus:border-[#8B5A2B]"
          />
        </div>
      </div>

      <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-2">
        {products.length > 0 ? products.map((p) => {
          const checked = selectedProducts.includes(p.id);
          return (
            <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 xl:py-2 text-sm transition duration-150 hover:bg-[#F2ECE5]">
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle(p.id, e.target.checked)}
                className="h-4 w-4 accent-[#8B5A2B]"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[#5F3B18]">{p.name}</span>
                <span className="mt-0.5 block text-xs text-[#8F6A49]">
                  Stock {p.stock} · {p.isActive ? "Activo" : "Inactivo"}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-[#70471F]">${p.price.toLocaleString("es-AR")}</span>
            </label>
          );
        }) : (
          <div className="px-4 py-8 xl:py-6 text-center text-sm text-[#8F6A49]">No encontramos productos con esa búsqueda.</div>
        )}
      </div>
    </div>
  );
}

function PreviewBox({
  tab,
  form,
  promoCode,
  selectedCount,
}: {
  tab: ActiveTab;
  form: FormState;
  promoCode: string;
  selectedCount: number;
}) {
  const hasPercent = Number.isFinite(form.percent) && form.percent > 0;
  const text = (() => {
    if (!hasPercent) return "Completá los datos para ver un resumen del descuento.";
    if (tab === "global") return `Este descuento aplicará ${form.percent}% a toda la tienda.`;
    if (tab === "product") {
      if (selectedCount === 0) return `Este descuento aplicará ${form.percent}% a los productos que selecciones.`;
      return `Este descuento aplicará ${form.percent}% a ${selectedCount} producto${selectedCount === 1 ? "" : "s"} seleccionado${selectedCount === 1 ? "" : "s"}.`;
    }
    if (!promoCode.trim()) return `El código que definas dará ${form.percent}% de descuento en el carrito.`;
    return `El código ${promoCode.trim().toUpperCase()} dará ${form.percent}% de descuento en el carrito.`;
  })();

  return (
    <aside className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#8B5A2B] p-3 text-white">
          <BadgePercent className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-semibold text-[#5F3B18]">Preview del descuento</h2>
          <p className="mt-1 text-sm text-[#8F6A49]">Resumen antes de crear la promoción.</p>
        </div>
      </div>
      <p className="mt-5 rounded-2xl border border-[#E5D7C8] bg-white/65 px-4 py-4 xl:py-2.5 text-sm leading-6 text-[#70471F]">
        {text}
      </p>
      <div className="mt-4 text-xs text-[#A37A55]">
        Vigencia: {form.startsAt ? formatDate(form.startsAt) : "activa inmediatamente"} → {form.endsAt ? formatDate(form.endsAt) : "sin vencimiento automático"}
      </div>
    </aside>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E5D7C8] bg-[#FAF8F5]/70 px-5 py-10 xl:py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#8B5A2B] shadow-sm">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="mt-4 font-semibold text-[#5F3B18]">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#8F6A49]">{description}</p>
      {action}
    </div>
  );
}
