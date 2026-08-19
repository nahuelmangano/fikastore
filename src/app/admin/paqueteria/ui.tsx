"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, CheckCircle2, PackageCheck, Settings, Store, Truck } from "lucide-react";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import SectionCard from "@/components/admin/cards/SectionCard";
import StatCard from "@/components/admin/cards/StatCard";
import EmptyState from "@/components/admin/data/EmptyState";
import StatusBadge from "@/components/admin/data/StatusBadge";

type Carrier = {
  key: string;
  name: string;
  enabled: boolean;
  visibleToMerchant: boolean;
  custom: boolean;
  description: string;
  flatRate: number;
  pricingMode: "fixed" | "agreement";
  configured: boolean;
  requiredCount: number;
  completedCount: number;
};

const providerMeta: Record<string, { description: string; group: "delivery" | "pickup"; icon: typeof Truck }> = {
  epick: { description: "Envíos a domicilio con gestión de tracking.", group: "delivery", icon: Truck },
  andreani: { description: "Correo y distribución nacional.", group: "delivery", icon: PackageCheck },
  correo: { description: "Correo nacional con entrega a domicilio o sucursal.", group: "delivery", icon: Building2 },
  pickup: { description: "Retiro presencial en comercio.", group: "pickup", icon: Store },
};

export default function AdminPaqueteria({
  carriers,
  canManageMerchantVisibility,
}: {
  carriers: Carrier[];
  canManageMerchantVisibility: boolean;
}) {
  const [items, setItems] = useState<Carrier[]>(carriers);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customFlatRate, setCustomFlatRate] = useState("");
  const [customPricingMode, setCustomPricingMode] = useState<"fixed" | "agreement">("fixed");
  const [creatingCustom, setCreatingCustom] = useState(false);

  const summary = useMemo(() => {
    const enabled = items.filter((carrier) => carrier.enabled).length;
    const configured = items.filter((carrier) => carrier.configured).length;
    return {
      total: items.length,
      enabled,
      disabled: items.length - enabled,
      configured,
      pendingConfig: items.length - configured,
      visibleToMerchant: items.filter((carrier) => carrier.visibleToMerchant).length,
    };
  }, [items]);

  const deliveryCarriers = items.filter((carrier) => (providerMeta[carrier.key]?.group ?? "delivery") === "delivery");
  const pickupCarriers = items.filter((carrier) => providerMeta[carrier.key]?.group === "pickup");

  function patchCarrierFromResponse(carrier: Carrier) {
    setItems((prev) => prev.map((item) => (item.key === carrier.key ? { ...item, ...carrier } : item)));
  }

  async function toggleCarrier(carrier: Carrier) {
    setMsg(null);
    setLoadingKey(carrier.key);
    const next = !carrier.enabled;

    const res = await fetch("/api/admin/shipping/carriers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: carrier.key, enabled: next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoadingKey(null);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo actualizar el método de envío."));
      return;
    }

    if (data?.carrier) patchCarrierFromResponse(data.carrier);
    else setItems((prev) => prev.map((item) => (item.key === carrier.key ? { ...item, enabled: next } : item)));
    setMsg(next ? `${carrier.name} habilitado.` : `${carrier.name} deshabilitado.`);
  }

  async function toggleMerchantVisibility(carrier: Carrier) {
    setMsg(null);
    setLoadingKey(carrier.key);
    const next = !carrier.visibleToMerchant;

    const res = await fetch("/api/admin/shipping/carriers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: carrier.key, visibleToMerchant: next }),
    });
    const data = await res.json().catch(() => ({}));
    setLoadingKey(null);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo actualizar la visibilidad del método."));
      return;
    }

    if (data?.carrier) patchCarrierFromResponse(data.carrier);
    else setItems((prev) => prev.map((item) => (item.key === carrier.key ? { ...item, visibleToMerchant: next } : item)));
    setMsg(next ? `${carrier.name} visible para merchants.` : `${carrier.name} oculto para merchants.`);
  }

  async function createCustomCarrier() {
    setMsg(null);
    setCreatingCustom(true);
    const res = await fetch("/api/admin/shipping/carriers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: customName,
        description: customDescription,
        flatRate: Number(customFlatRate || 0),
        pricingMode: customPricingMode,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCreatingCustom(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo crear el método personalizado."));
      return;
    }

    setItems((prev) => [...prev, data.carrier]);
    setCustomName("");
    setCustomDescription("");
    setCustomFlatRate("");
    setCustomPricingMode("fixed");
    setMsg(`${data.carrier?.name || "Método personalizado"} creado.`);
  }

  async function saveCustomCarrier(carrier: Carrier, patch: Partial<Carrier>) {
    setMsg(null);
    setLoadingKey(carrier.key);
    const res = await fetch("/api/admin/shipping/carriers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: carrier.key,
        name: patch.name ?? carrier.name,
        description: patch.description ?? carrier.description,
        flatRate: patch.flatRate ?? carrier.flatRate,
        pricingMode: patch.pricingMode ?? carrier.pricingMode,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoadingKey(null);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo guardar el método personalizado."));
      return;
    }

    if (data?.carrier) patchCarrierFromResponse(data.carrier);
    setMsg(`${data.carrier?.name || carrier.name} actualizado.`);
  }

  return (
    <main className="min-h-screen bg-[var(--admin-background)] text-[var(--admin-text-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <AdminPageHeader
          eyebrow="Admin · Envíos"
          title="Paquetería"
          subtitle={`Configurá los métodos de entrega disponibles para tus clientes. ${summary.total} métodos · ${summary.enabled} habilitados · ${summary.disabled} deshabilitados.`}
          backHref="/admin"
        />

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Métodos" value={summary.total} description="Disponibles en el panel" icon={Truck} />
          <StatCard title="Habilitados" value={summary.enabled} description="Visibles para checkout" icon={CheckCircle2} />
          <StatCard title="Deshabilitados" value={summary.disabled} description="No disponibles" icon={Settings} />
          <StatCard
            title={canManageMerchantVisibility ? "Visibles" : "Configurados"}
            value={canManageMerchantVisibility ? summary.visibleToMerchant : summary.configured}
            description={canManageMerchantVisibility ? "Aparecen al merchant" : `${summary.pendingConfig} requiere atención`}
            icon={PackageCheck}
          />
        </section>

        {msg ? (
          <div className="mt-6 xl:mt-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text-soft)] shadow-[var(--admin-shadow)]">
            {msg}
          </div>
        ) : null}

        <SectionCard className="mt-8 xl:mt-6" title="Método personalizado" description="Agregá opciones propias como motomensajería, comisionista o cadetería local.">
          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_160px_180px_auto]">
            <label className="block">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Nombre</span>
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Motomensajería"
                className="admin-input mt-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Descripción</span>
              <input
                value={customDescription}
                onChange={(event) => setCustomDescription(event.target.value)}
                placeholder="Entrega en moto dentro de la zona."
                className="admin-input mt-2"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Modo</span>
              <select
                value={customPricingMode}
                onChange={(event) => setCustomPricingMode(event.target.value === "agreement" ? "agreement" : "fixed")}
                className="admin-input mt-2"
              >
                <option value="fixed">Precio fijo</option>
                <option value="agreement">A convenir</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-[var(--admin-text)]">Precio</span>
              <input
                value={customFlatRate}
                onChange={(event) => setCustomFlatRate(event.target.value.replace(/[^\d.]/g, ""))}
                placeholder="2500"
                inputMode="decimal"
                disabled={customPricingMode === "agreement"}
                className="admin-input mt-2"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={createCustomCarrier}
                disabled={creatingCustom || !customName.trim()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creatingCustom ? "Creando..." : "Agregar"}
              </button>
            </div>
          </div>
        </SectionCard>

        {items.length === 0 ? (
          <SectionCard className="mt-8 xl:mt-6">
            <EmptyState
              icon={Truck}
              title="Todavía no configuraste métodos de envío."
              description="Configurá al menos uno para que tus clientes puedan finalizar compras."
            />
          </SectionCard>
        ) : (
          <div className="mt-8 xl:mt-6 space-y-6">
            {deliveryCarriers.length > 0 ? (
              <ProviderGroup title="Envíos a domicilio" description="Métodos que entregan el pedido al cliente o permiten despacho por correo.">
                {deliveryCarriers.map((carrier) => (
                  <ProviderCard
                    key={carrier.key}
                    carrier={carrier}
                    busy={loadingKey === carrier.key}
                    canManageMerchantVisibility={canManageMerchantVisibility}
                    onToggle={() => void toggleCarrier(carrier)}
                    onToggleMerchantVisibility={() => void toggleMerchantVisibility(carrier)}
                    onSaveCustom={(patch) => void saveCustomCarrier(carrier, patch)}
                  />
                ))}
              </ProviderGroup>
            ) : null}

            {pickupCarriers.length > 0 ? (
              <ProviderGroup title="Retiro" description="Opciones para que el cliente retire su compra.">
                {pickupCarriers.map((carrier) => (
                  <ProviderCard
                    key={carrier.key}
                    carrier={carrier}
                    busy={loadingKey === carrier.key}
                    canManageMerchantVisibility={canManageMerchantVisibility}
                    onToggle={() => void toggleCarrier(carrier)}
                    onToggleMerchantVisibility={() => void toggleMerchantVisibility(carrier)}
                    onSaveCustom={(patch) => void saveCustomCarrier(carrier, patch)}
                  />
                ))}
              </ProviderGroup>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}

function ProviderGroup({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <SectionCard title={title} description={description}>
      <div className="grid gap-4 lg:grid-cols-2">{children}</div>
    </SectionCard>
  );
}

function ProviderCard({
  carrier,
  busy,
  canManageMerchantVisibility,
  onToggle,
  onToggleMerchantVisibility,
  onSaveCustom,
}: {
  carrier: Carrier;
  busy: boolean;
  canManageMerchantVisibility: boolean;
  onToggle: () => void;
  onToggleMerchantVisibility: () => void;
  onSaveCustom: (patch: Partial<Carrier>) => void;
}) {
  const meta = providerMeta[carrier.key] ?? { description: carrier.description || "Método de envío personalizado.", group: "delivery" as const, icon: Truck };
  const Icon = meta.icon;
  const needsConfig = !carrier.configured;
  const [customName, setCustomName] = useState(carrier.name);
  const [customDescription, setCustomDescription] = useState(carrier.description);
  const [customFlatRate, setCustomFlatRate] = useState(String(carrier.flatRate || 0));
  const [customPricingMode, setCustomPricingMode] = useState<"fixed" | "agreement">(carrier.pricingMode);

  return (
    <article className="rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-5 xl:p-4 transition duration-150 hover:-translate-y-0.5 hover:shadow-[var(--admin-shadow)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--admin-surface-muted)] text-[var(--admin-primary)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-[var(--admin-text)]">{carrier.name}</h3>
              {needsConfig ? <StatusBadge label="Configuración pendiente" variant="warning" /> : <StatusBadge label="Configurado" variant="success" />}
              {canManageMerchantVisibility && !carrier.visibleToMerchant ? <StatusBadge label="Oculto para merchant" variant="neutral" /> : null}
            </div>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">{carrier.custom ? carrier.description : meta.description}</p>
            <div className="mt-2 text-xs text-[var(--admin-muted)]">
              Identificador: <span className="font-mono">{carrier.key}</span>
            </div>
            {carrier.custom ? (
              <div className="mt-2 text-xs font-semibold text-[var(--admin-primary)]">
                {carrier.pricingMode === "agreement"
                  ? "Precio a convenir"
                  : `Precio fijo: $${carrier.flatRate.toLocaleString("es-AR")}`}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={carrier.enabled}
            aria-label={`${carrier.enabled ? "Deshabilitar" : "Habilitar"} ${carrier.name}`}
            disabled={busy}
            onClick={onToggle}
            className={[
              "inline-flex min-w-36 items-center justify-center rounded-2xl px-4 py-2.5 xl:py-2 text-sm font-semibold transition duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-60",
              carrier.enabled
                ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
                : "bg-[var(--admin-surface-muted)] text-[var(--admin-primary)] ring-1 ring-[var(--admin-border)] hover:bg-white",
            ].join(" ")}
          >
            {busy ? "Actualizando..." : carrier.enabled ? "Habilitado" : "Deshabilitado"}
          </button>
          {canManageMerchantVisibility ? (
            <button
              type="button"
              role="switch"
              aria-checked={carrier.visibleToMerchant}
              aria-label={`${carrier.visibleToMerchant ? "Ocultar" : "Mostrar"} ${carrier.name} al merchant`}
              disabled={busy}
              onClick={onToggleMerchantVisibility}
              className={[
                "inline-flex min-w-36 items-center justify-center rounded-2xl px-4 py-2 xl:py-1.5 text-sm font-semibold transition duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:opacity-60",
                carrier.visibleToMerchant
                  ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100"
                  : "bg-red-50 text-red-800 ring-1 ring-red-200 hover:bg-red-100",
              ].join(" ")}
            >
              {carrier.visibleToMerchant ? "Visible merchant" : "Oculto merchant"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Estado operativo</div>
          <div className="mt-2">
            <StatusBadge label={carrier.enabled ? "Disponible en checkout" : "No disponible"} variant={carrier.enabled ? "success" : "neutral"} />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Configuración</div>
          <div className="mt-2 text-sm text-[var(--admin-text-soft)]">
            {carrier.requiredCount === 0
              ? "No requiere credenciales"
              : `${carrier.completedCount} de ${carrier.requiredCount} campos requeridos`}
          </div>
        </div>
        {canManageMerchantVisibility ? (
          <div className="rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3 sm:col-span-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Visibilidad en panel merchant</div>
            <div className="mt-2">
              <StatusBadge
                label={carrier.visibleToMerchant ? "Visible para merchant" : "Oculto para merchant"}
                variant={carrier.visibleToMerchant ? "info" : "neutral"}
              />
            </div>
          </div>
        ) : null}
      </div>

      {carrier.custom ? (
        <div className="mt-5 rounded-2xl border border-[var(--admin-border)] bg-white/60 p-4">
          <div className="text-sm font-semibold text-[var(--admin-text)]">Configuración personalizada</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Nombre</span>
              <input value={customName} onChange={(event) => setCustomName(event.target.value)} className="admin-input mt-2" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Descripción</span>
              <input value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} className="admin-input mt-2" />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Modo</span>
              <select
                value={customPricingMode}
                onChange={(event) => setCustomPricingMode(event.target.value === "agreement" ? "agreement" : "fixed")}
                className="admin-input mt-2"
              >
                <option value="fixed">Precio fijo</option>
                <option value="agreement">A convenir</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Precio</span>
              <input
                value={customFlatRate}
                onChange={(event) => setCustomFlatRate(event.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                disabled={customPricingMode === "agreement"}
                className="admin-input mt-2"
              />
            </label>
            <div className="flex justify-end sm:col-span-2">
              <button
                type="button"
                disabled={busy || !customName.trim()}
                onClick={() =>
                  onSaveCustom({
                    name: customName,
                    description: customDescription,
                    flatRate: Number(customFlatRate || 0),
                    pricingMode: customPricingMode,
                  })
                }
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-[var(--admin-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[var(--admin-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {needsConfig ? (
          <p className="text-sm text-[var(--admin-muted)]">Completá la configuración antes de usarlo con confianza.</p>
        ) : (
          <p className="text-sm text-[var(--admin-muted)]">Listo para administrar desde el checkout y el detalle de pedidos.</p>
        )}
        {carrier.custom ? null : (
          <Link
            href={`/admin/paqueteria/${carrier.key}`}
            className="inline-flex items-center justify-center rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          >
            {needsConfig ? "Completar configuración" : "Editar configuración"}
          </Link>
        )}
      </div>
    </article>
  );
}
