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

export default function AdminPaqueteria({ carriers }: { carriers: Carrier[] }) {
  const [items, setItems] = useState<Carrier[]>(carriers);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const summary = useMemo(() => {
    const enabled = items.filter((carrier) => carrier.enabled).length;
    const configured = items.filter((carrier) => carrier.configured).length;
    return {
      total: items.length,
      enabled,
      disabled: items.length - enabled,
      configured,
      pendingConfig: items.length - configured,
    };
  }, [items]);

  const deliveryCarriers = items.filter((carrier) => (providerMeta[carrier.key]?.group ?? "delivery") === "delivery");
  const pickupCarriers = items.filter((carrier) => providerMeta[carrier.key]?.group === "pickup");

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

    setItems((prev) => prev.map((item) => (item.key === carrier.key ? { ...item, enabled: next } : item)));
    setMsg(next ? `${carrier.name} habilitado.` : `${carrier.name} deshabilitado.`);
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
          <StatCard title="Configurados" value={summary.configured} description={`${summary.pendingConfig} requiere atención`} icon={PackageCheck} />
        </section>

        {msg ? (
          <div className="mt-6 xl:mt-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text-soft)] shadow-[var(--admin-shadow)]">
            {msg}
          </div>
        ) : null}

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
                  <ProviderCard key={carrier.key} carrier={carrier} busy={loadingKey === carrier.key} onToggle={() => void toggleCarrier(carrier)} />
                ))}
              </ProviderGroup>
            ) : null}

            {pickupCarriers.length > 0 ? (
              <ProviderGroup title="Retiro" description="Opciones para que el cliente retire su compra.">
                {pickupCarriers.map((carrier) => (
                  <ProviderCard key={carrier.key} carrier={carrier} busy={loadingKey === carrier.key} onToggle={() => void toggleCarrier(carrier)} />
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

function ProviderCard({ carrier, busy, onToggle }: { carrier: Carrier; busy: boolean; onToggle: () => void }) {
  const meta = providerMeta[carrier.key] ?? { description: "Método de envío disponible.", group: "delivery" as const, icon: Truck };
  const Icon = meta.icon;
  const needsConfig = !carrier.configured;

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
            </div>
            <p className="mt-1 text-sm text-[var(--admin-muted)]">{meta.description}</p>
            <div className="mt-2 text-xs text-[var(--admin-muted)]">
              Identificador: <span className="font-mono">{carrier.key}</span>
            </div>
          </div>
        </div>

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
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {needsConfig ? (
          <p className="text-sm text-[var(--admin-muted)]">Completá la configuración antes de usarlo con confianza.</p>
        ) : (
          <p className="text-sm text-[var(--admin-muted)]">Listo para administrar desde el checkout y el detalle de pedidos.</p>
        )}
        <Link
          href={`/admin/paqueteria/${carrier.key}`}
          className="inline-flex items-center justify-center rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
        >
          {needsConfig ? "Completar configuración" : "Editar configuración"}
        </Link>
      </div>
    </article>
  );
}
