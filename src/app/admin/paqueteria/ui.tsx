"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  pricingMode: "fixed" | "agreement" | "free";
  deliveryDays: string | null;
  shippingSurcharge: number;
  freeShippingMinimumSubtotal: number;
  freeShippingMinimumDeliveryTypes: PromotionFreeShippingDeliveryType[];
  configured: boolean;
  requiredCount: number;
  completedCount: number;
};

type PromotionPaymentMethod = "mercadopago" | "agreement" | "cash" | "transfer";
type PromotionFreeShippingDeliveryType = "D" | "S";

type ShippingPromotion = {
  id: string;
  name: string;
  freeShipping: boolean;
  freeShippingDeliveryTypes: PromotionFreeShippingDeliveryType[];
  freeShippingCarrierKeys: string[];
  paymentMethods: PromotionPaymentMethod[];
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

const paymentMethodOptions: { key: PromotionPaymentMethod; label: string }[] = [
  { key: "mercadopago", label: "Mercado Pago" },
  { key: "transfer", label: "Transferencia" },
  { key: "cash", label: "Efectivo" },
  { key: "agreement", label: "A convenir" },
];

const freeShippingDeliveryTypeOptions: { key: PromotionFreeShippingDeliveryType; label: string }[] = [
  { key: "D", label: "Domicilio" },
  { key: "S", label: "Sucursal" },
];

function formatPromotionDate(v: string | null) {
  if (!v) return "Sin fecha";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function paymentMethodsLabel(methods: PromotionPaymentMethod[]) {
  if (!methods.length) return "Todos los pagos";
  return methods
    .map((method) => paymentMethodOptions.find((option) => option.key === method)?.label || method)
    .join(" · ");
}

function deliveryTypesLabel(types: PromotionFreeShippingDeliveryType[]) {
  if (!types.length) return "Domicilio y sucursal";
  return types
    .map((type) => freeShippingDeliveryTypeOptions.find((option) => option.key === type)?.label || type)
    .join(" · ");
}

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
  const [customPricingMode, setCustomPricingMode] = useState<"fixed" | "agreement" | "free">("fixed");
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
        ...(typeof patch.deliveryDays === "string" ? { deliveryDays: patch.deliveryDays } : {}),
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
                onChange={(event) => setCustomPricingMode(event.target.value === "agreement" ? "agreement" : event.target.value === "free" ? "free" : "fixed")}
                className="admin-input mt-2"
              >
                <option value="fixed">Precio fijo</option>
                <option value="agreement">A convenir</option>
                <option value="free">Gratis</option>
              </select>
            </label>
            {customPricingMode === "fixed" ? (
              <label className="block">
                <span className="text-sm font-semibold text-[var(--admin-text)]">Precio</span>
                <input
                  value={customFlatRate}
                  onChange={(event) => setCustomFlatRate(event.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="2500"
                  inputMode="decimal"
                  className="admin-input mt-2"
                />
              </label>
            ) : null}
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
  const [customPricingMode, setCustomPricingMode] = useState<"fixed" | "agreement" | "free">(carrier.pricingMode);
  const [deliveryDays, setDeliveryDays] = useState(carrier.deliveryDays ?? "");
  const supportsDeliveryDays = carrier.key === "epick" || carrier.key === "correo";
  const supportsFreeShippingPromotions = carrier.key === "correo";
  const [shippingPromotions, setShippingPromotions] = useState<ShippingPromotion[]>([]);
  const [shippingPromotionsLoading, setShippingPromotionsLoading] = useState(false);
  const [shippingPromotionsBusyId, setShippingPromotionsBusyId] = useState<string | null>(null);
  const [shippingPromotionsDeletingId, setShippingPromotionsDeletingId] = useState<string | null>(null);
  const [shippingPromotionsMsg, setShippingPromotionsMsg] = useState<string | null>(null);
  const [shippingPromotionsError, setShippingPromotionsError] = useState<string | null>(null);
  const [shippingPromotionsModalOpen, setShippingPromotionsModalOpen] = useState(false);
  const [promotionName, setPromotionName] = useState("Envío gratis Correo Argentino");
  const [promotionDeliveryTypes, setPromotionDeliveryTypes] = useState<PromotionFreeShippingDeliveryType[]>([]);
  const [promotionPaymentMethods, setPromotionPaymentMethods] = useState<PromotionPaymentMethod[]>([]);
  const [promotionStartsAt, setPromotionStartsAt] = useState("");
  const [promotionEndsAt, setPromotionEndsAt] = useState("");
  const [creatingPromotion, setCreatingPromotion] = useState(false);
  const [shippingSurcharge, setShippingSurcharge] = useState(String(carrier.shippingSurcharge || 0));
  const [savingShippingSurcharge, setSavingShippingSurcharge] = useState(false);
  const [freeShippingMinimumSubtotal, setFreeShippingMinimumSubtotal] = useState(String(carrier.freeShippingMinimumSubtotal || 0));
  const [freeShippingMinimumDeliveryTypes, setFreeShippingMinimumDeliveryTypes] = useState<PromotionFreeShippingDeliveryType[]>(
    carrier.freeShippingMinimumDeliveryTypes || []
  );
  const [savingFreeShippingMinimumSubtotal, setSavingFreeShippingMinimumSubtotal] = useState(false);

  useEffect(() => {
    if (!supportsFreeShippingPromotions) return;

    let cancelled = false;
    (async () => {
      setShippingPromotionsLoading(true);
      setShippingPromotionsError(null);
      const res = await fetch("/api/admin/promotions");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      setShippingPromotionsLoading(false);
      if (!res.ok) {
        setShippingPromotionsError(data?.error || "No se pudieron cargar las bonificaciones.");
        return;
      }
      const promotions = Array.isArray(data?.promotions) ? (data.promotions as ShippingPromotion[]) : [];
      setShippingPromotions(
        promotions.filter((promotion) => promotion.freeShipping && promotion.freeShippingCarrierKeys.includes("correo"))
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [supportsFreeShippingPromotions]);

  async function createShippingPromotion() {
    if (!promotionName.trim()) {
      setShippingPromotionsError("Ingresá un nombre para la bonificación.");
      setShippingPromotionsMsg(null);
      return;
    }
    if (promotionStartsAt && promotionEndsAt && new Date(promotionStartsAt) > new Date(promotionEndsAt)) {
      setShippingPromotionsError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      setShippingPromotionsMsg(null);
      return;
    }

    setCreatingPromotion(true);
    setShippingPromotionsError(null);
    setShippingPromotionsMsg(null);
    const res = await fetch("/api/admin/promotions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: promotionName.trim(),
        type: "global",
        percent: 0,
        freeShipping: true,
        freeShippingDeliveryTypes: promotionDeliveryTypes,
        freeShippingCarrierKeys: ["correo"],
        paymentMethods: promotionPaymentMethods,
        startsAt: promotionStartsAt || null,
        endsAt: promotionEndsAt || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setCreatingPromotion(false);

    if (!res.ok) {
      setShippingPromotionsError(data?.error || "No se pudo crear la bonificación.");
      return;
    }

    setShippingPromotions((prev) => [data.promotion as ShippingPromotion, ...prev]);
    setPromotionName("Envío gratis Correo Argentino");
    setPromotionDeliveryTypes([]);
    setPromotionPaymentMethods([]);
    setPromotionStartsAt("");
    setPromotionEndsAt("");
    setShippingPromotionsMsg(`Bonificación creada: ${data?.promotion?.name || "Envío gratis Correo Argentino"}.`);
  }

  async function toggleShippingPromotion(promotion: ShippingPromotion) {
    setShippingPromotionsBusyId(promotion.id);
    setShippingPromotionsError(null);
    setShippingPromotionsMsg(null);
    const res = await fetch(`/api/admin/promotions/${promotion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !promotion.isActive }),
    });
    const data = await res.json().catch(() => ({}));
    setShippingPromotionsBusyId(null);

    if (!res.ok) {
      setShippingPromotionsError(data?.error || "No se pudo actualizar la bonificación.");
      return;
    }

    setShippingPromotions((prev) =>
      prev.map((item) => (item.id === promotion.id ? { ...item, isActive: data?.promotion?.isActive ?? !item.isActive } : item))
    );
    setShippingPromotionsMsg(
      `${promotion.name} ${data?.promotion?.isActive ? "activada" : "desactivada"}.`
    );
  }

  async function deleteShippingPromotion(promotion: ShippingPromotion) {
    setShippingPromotionsDeletingId(promotion.id);
    setShippingPromotionsError(null);
    setShippingPromotionsMsg(null);
    const res = await fetch(`/api/admin/promotions/${promotion.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setShippingPromotionsDeletingId(null);

    if (!res.ok) {
      setShippingPromotionsError(data?.error || "No se pudo eliminar la bonificación.");
      return;
    }

    setShippingPromotions((prev) => prev.filter((item) => item.id !== promotion.id));
    setShippingPromotionsMsg(`Bonificación eliminada: ${promotion.name}.`);
  }

  function toggleDeliveryType(type: PromotionFreeShippingDeliveryType) {
    setPromotionDeliveryTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
  }

  function togglePaymentMethod(method: PromotionPaymentMethod) {
    setPromotionPaymentMethods((prev) => (prev.includes(method) ? prev.filter((item) => item !== method) : [...prev, method]));
  }

  async function saveShippingSurcharge() {
    const nextValue = Number(String(shippingSurcharge || "0").replace(",", "."));
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      setShippingPromotionsError("Ingresá un recargo válido mayor o igual a 0.");
      setShippingPromotionsMsg(null);
      return;
    }

    setSavingShippingSurcharge(true);
    setShippingPromotionsError(null);
    setShippingPromotionsMsg(null);
    const res = await fetch("/api/admin/shipping/carriers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: carrier.key, shippingSurcharge: nextValue }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingShippingSurcharge(false);

    if (!res.ok) {
      setShippingPromotionsError(data?.error || "No se pudo guardar el recargo.");
      return;
    }

    setShippingSurcharge(String(data?.carrier?.shippingSurcharge ?? nextValue));
    setShippingPromotionsMsg(`Recargo actualizado a $${Number(data?.carrier?.shippingSurcharge ?? nextValue).toLocaleString("es-AR")}.`);
  }

  async function saveFreeShippingMinimumSubtotal() {
    const nextValue = Number(String(freeShippingMinimumSubtotal || "0").replace(",", "."));
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      setShippingPromotionsError("Ingresá un monto mínimo válido mayor o igual a 0.");
      setShippingPromotionsMsg(null);
      return;
    }

    setSavingFreeShippingMinimumSubtotal(true);
    setShippingPromotionsError(null);
    setShippingPromotionsMsg(null);
    const res = await fetch("/api/admin/shipping/carriers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: carrier.key,
        freeShippingMinimumSubtotal: nextValue,
        freeShippingMinimumDeliveryTypes,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingFreeShippingMinimumSubtotal(false);

    if (!res.ok) {
      setShippingPromotionsError(data?.error || "No se pudo guardar el monto mínimo.");
      return;
    }

    setFreeShippingMinimumSubtotal(String(data?.carrier?.freeShippingMinimumSubtotal ?? nextValue));
    setFreeShippingMinimumDeliveryTypes(data?.carrier?.freeShippingMinimumDeliveryTypes ?? freeShippingMinimumDeliveryTypes);
    setShippingPromotionsMsg(
      nextValue > 0
        ? `Envío gratis automático desde $${Number(data?.carrier?.freeShippingMinimumSubtotal ?? nextValue).toLocaleString("es-AR")}.`
        : "Monto mínimo para envío gratis desactivado."
    );
  }

  function toggleMinimumDeliveryType(type: PromotionFreeShippingDeliveryType) {
    setFreeShippingMinimumDeliveryTypes((prev) => (prev.includes(type) ? prev.filter((item) => item !== type) : [...prev, type]));
  }

  return (
    <article className="rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-5 xl:p-4 transition duration-150 hover:shadow-[var(--admin-shadow)]">
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
                  : carrier.pricingMode === "free"
                    ? "Envío gratis"
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

      {supportsDeliveryDays && (
        <div className="mt-5 rounded-2xl border border-[var(--admin-border)] bg-white/60 p-4">
          <div className="text-sm font-semibold text-[var(--admin-text)]">Tiempo estimado de entrega</div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="block max-w-xs flex-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Días hábiles luego de ser despachado</span>
              <input value={deliveryDays} onChange={(event) => setDeliveryDays(event.target.value)} placeholder="Ej. 3-6" className="admin-input mt-2" />
            </label>
            <button type="button" disabled={busy || !deliveryDays.trim()} onClick={() => onSaveCustom({ deliveryDays: deliveryDays.trim() })} className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--admin-primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">Guardar días</button>
          </div>
        </div>
      )}

      {supportsFreeShippingPromotions && (
        <div className="mt-5 rounded-2xl border border-[var(--admin-border)] bg-white/60 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--admin-text)]">Bonificación de envíos</div>
              <p className="mt-1 text-sm text-[var(--admin-text-soft)]">
                Creá y administrá desde acá las bonificaciones de Correo Argentino por tipo de entrega, medio de pago y vigencia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShippingPromotionsModalOpen(true)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--admin-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[var(--admin-primary-hover)]"
            >
              Gestionar bonificaciones
            </button>
          </div>

          {shippingPromotionsMsg ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {shippingPromotionsMsg}
            </div>
          ) : null}
          {shippingPromotionsError ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {shippingPromotionsError}
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-3">
            <div className="text-sm font-semibold text-[var(--admin-text)]">Resumen actual</div>
            {shippingPromotionsLoading ? (
              <div className="mt-2 text-sm text-[var(--admin-muted)]">Cargando bonificaciones...</div>
            ) : (
              <div className="mt-2 text-sm text-[var(--admin-text-soft)]">
                {shippingPromotions.length === 0
                  ? "No hay bonificaciones creadas para Correo Argentino."
                  : `${shippingPromotions.filter((promotion) => promotion.isActive).length} activas de ${shippingPromotions.length} configuradas.`}
              </div>
            )}
          </div>
        </div>
      )}

      {supportsFreeShippingPromotions && shippingPromotionsModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8 sm:py-12">
          <button
            type="button"
            aria-label="Cerrar bonificaciones"
            className="absolute inset-0 bg-black/35"
            onClick={() => setShippingPromotionsModalOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`shipping-promotions-title-${carrier.key}`}
            className="relative w-full max-w-4xl rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-5 shadow-2xl"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h4 id={`shipping-promotions-title-${carrier.key}`} className="text-lg font-semibold text-[var(--admin-text)]">
                  Bonificaciones de Correo Argentino
                </h4>
                <p className="mt-1 text-sm text-[var(--admin-text-soft)]">
                  Configurá envío gratis por modalidad, pago y vigencia sin salir de paquetería.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShippingPromotionsModalOpen(false)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
              >
                Cerrar
              </button>
            </div>

            {shippingPromotionsMsg ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {shippingPromotionsMsg}
              </div>
            ) : null}
            {shippingPromotionsError ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {shippingPromotionsError}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Nombre de la bonificación</span>
                <input value={promotionName} onChange={(event) => setPromotionName(event.target.value)} className="admin-input mt-2" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Inicio</span>
                  <input type="datetime-local" value={promotionStartsAt} onChange={(event) => setPromotionStartsAt(event.target.value)} className="admin-input mt-2" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Fin</span>
                  <input type="datetime-local" value={promotionEndsAt} onChange={(event) => setPromotionEndsAt(event.target.value)} className="admin-input mt-2" />
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="block sm:max-w-xs sm:flex-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Recargo fijo al envío</span>
                    <input
                      value={shippingSurcharge}
                      onChange={(event) => setShippingSurcharge(event.target.value.replace(/[^\d.,]/g, ""))}
                      inputMode="decimal"
                      placeholder="0"
                      className="admin-input mt-2"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingShippingSurcharge}
                    onClick={() => void saveShippingSurcharge()}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] disabled:opacity-60"
                  >
                    {savingShippingSurcharge ? "Guardando..." : "Guardar recargo"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-[var(--admin-muted)]">
                  Este monto se suma a cada tarifa cotizada de Correo Argentino antes de mostrarla en producto y checkout.
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <label className="block sm:max-w-xs sm:flex-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Monto mínimo para envío gratis</span>
                    <input
                      value={freeShippingMinimumSubtotal}
                      onChange={(event) => setFreeShippingMinimumSubtotal(event.target.value.replace(/[^\d.,]/g, ""))}
                      inputMode="decimal"
                      placeholder="0"
                      className="admin-input mt-2"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={savingFreeShippingMinimumSubtotal}
                    onClick={() => void saveFreeShippingMinimumSubtotal()}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] disabled:opacity-60"
                  >
                    {savingFreeShippingMinimumSubtotal ? "Guardando..." : "Guardar mínimo"}
                  </button>
                </div>
                <div className="mt-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Aplicar a</div>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {freeShippingDeliveryTypeOptions.map((option) => {
                      const selected = freeShippingMinimumDeliveryTypes.includes(option.key);
                      return (
                        <label
                          key={option.key}
                          className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-white px-3 py-2 text-sm text-[var(--admin-text)]"
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleMinimumDeliveryType(option.key)}
                            className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <p className="mt-3 text-xs text-[var(--admin-muted)]">
                  Si cargás un valor mayor a 0, el envío de Correo Argentino pasa a gratis automáticamente cuando el subtotal final lo alcanza. Si no seleccionás ningún tipo, aplica a domicilio y sucursal.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Tipo de entrega bonificado</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {freeShippingDeliveryTypeOptions.map((option) => {
                    const selected = promotionDeliveryTypes.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleDeliveryType(option.key)}
                        className={[
                          "rounded-2xl border px-3 py-2 text-sm font-semibold transition duration-150",
                          selected
                            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-white"
                            : "border-[var(--admin-border)] bg-white text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-[var(--admin-muted)]">Si no seleccionás ninguno, aplica a domicilio y sucursal.</p>
              </div>

              <div className="rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Medios de pago</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {paymentMethodOptions.map((option) => {
                    const selected = promotionPaymentMethods.includes(option.key);
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => togglePaymentMethod(option.key)}
                        className={[
                          "rounded-2xl border px-3 py-2 text-sm font-semibold transition duration-150",
                          selected
                            ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-white"
                            : "border-[var(--admin-border)] bg-white text-[var(--admin-text)] hover:bg-[var(--admin-surface-muted)]",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-[var(--admin-muted)]">Si no seleccionás ninguno, aplica a cualquier medio de pago.</p>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={creatingPromotion}
                onClick={() => void createShippingPromotion()}
                className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-[var(--admin-primary)] px-5 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[var(--admin-primary-hover)] disabled:opacity-60"
              >
                {creatingPromotion ? "Guardando..." : "Crear bonificación"}
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[var(--admin-border)] bg-white/60 p-3">
              <div className="text-sm font-semibold text-[var(--admin-text)]">Bonificaciones activas para Correo Argentino</div>
              {shippingPromotionsLoading ? (
                <div className="mt-3 text-sm text-[var(--admin-muted)]">Cargando bonificaciones...</div>
              ) : shippingPromotions.length === 0 ? (
                <div className="mt-3 text-sm text-[var(--admin-muted)]">Todavía no hay bonificaciones creadas para este método.</div>
              ) : (
                <div className="mt-3 space-y-3">
                  {shippingPromotions.map((promotion) => (
                    <div key={promotion.id} className="rounded-2xl border border-[var(--admin-border)] bg-white p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-[var(--admin-text)]">{promotion.name}</div>
                            <StatusBadge label={promotion.isActive ? "Activa" : "Inactiva"} variant={promotion.isActive ? "success" : "neutral"} />
                          </div>
                          <div className="mt-2 text-xs text-[var(--admin-muted)]">
                            {deliveryTypesLabel(promotion.freeShippingDeliveryTypes)} · {paymentMethodsLabel(promotion.paymentMethods)}
                          </div>
                          <div className="mt-1 text-xs text-[var(--admin-muted)]">
                            Desde {formatPromotionDate(promotion.startsAt)} · Hasta {formatPromotionDate(promotion.endsAt)}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                          <button
                            type="button"
                            disabled={shippingPromotionsBusyId === promotion.id || shippingPromotionsDeletingId === promotion.id}
                            onClick={() => void toggleShippingPromotion(promotion)}
                            className={[
                              "inline-flex min-w-32 items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold transition duration-150 disabled:opacity-60",
                              promotion.isActive
                                ? "bg-red-50 text-red-800 ring-1 ring-red-200 hover:bg-red-100"
                                : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100",
                            ].join(" ")}
                          >
                            {shippingPromotionsBusyId === promotion.id ? "Actualizando..." : promotion.isActive ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            type="button"
                            disabled={shippingPromotionsDeletingId === promotion.id || shippingPromotionsBusyId === promotion.id}
                            onClick={() => void deleteShippingPromotion(promotion)}
                            className="inline-flex min-w-32 items-center justify-center rounded-2xl border border-red-800 bg-red-700 px-4 py-2 text-sm font-semibold !text-white shadow-sm transition duration-150 hover:bg-red-800 disabled:border-red-400 disabled:bg-red-500 disabled:!text-white disabled:opacity-60"
                          >
                            {shippingPromotionsDeletingId === promotion.id ? "Eliminando..." : "Eliminar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
                onChange={(event) => setCustomPricingMode(event.target.value === "agreement" ? "agreement" : event.target.value === "free" ? "free" : "fixed")}
                className="admin-input mt-2"
              >
                <option value="fixed">Precio fijo</option>
                <option value="agreement">A convenir</option>
                <option value="free">Gratis</option>
              </select>
            </label>
            {customPricingMode === "fixed" ? (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Precio</span>
                <input
                  value={customFlatRate}
                  onChange={(event) => setCustomFlatRate(event.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className="admin-input mt-2"
                />
              </label>
            ) : null}
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
