"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Banknote, Clock3, CreditCard, Handshake, Landmark, Mail, type LucideIcon } from "lucide-react";
import { CartItem, clearCart, clearPromoCode, readCart, readPromoCode } from "@/lib/cart";
import { validateArgentinaPostalCodeProvince } from "@/lib/argentinaPostalCode";
import { trackMetaInitiateCheckout } from "@/lib/metaPixelEvents";
import { transferInstructionsWithBankDetails } from "@/lib/manualPaymentInstructions";

type Shipping = {
  name: string;
  email: string;
  phone: string;
  addressLine: string;
  city: string;
  province: string;
  provinceCode: string;
  zip: string;
};

type BuiltInShippingMethod = "epick" | "andreani" | "correo" | "pickup";
type ShippingMethod = BuiltInShippingMethod | string;

const SELECTED_SHIPPING_KEY = "fika:selected-shipping";
type PaymentMethod = "mercadopago" | "agreement" | "cash" | "transfer";
type CorreoDeliveryType = "D" | "S";

type CorreoRate = {
  deliveredType?: string;
  price?: unknown;
};

type CorreoAgency = {
  code: string;
  name: string;
  addressLine: string;
  city: string;
  province: string;
  provinceCode: string;
  zip: string;
};

function postalCodeDistance(a: string, b: string) {
  const left = Number(String(a || "").replace(/\D/g, ""));
  const right = Number(String(b || "").replace(/\D/g, ""));
  if (!Number.isFinite(left) || !Number.isFinite(right) || left <= 0 || right <= 0) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Math.abs(left - right);
}

type EpickQuote = {
  price?: unknown;
  total?: unknown;
};

type AndreaniQuote = {
  tarifaConIva?: {
    total?: unknown;
  };
};

type PricingItem = {
  lineKey: string;
  productId: string;
  productVariantId?: string | null;
  basePrice?: number;
  finalPrice?: number;
  totalPercent?: number;
  autoPercent?: number;
  codePercent?: number;
  finalSubtotal?: number;
};

type PricingData = {
  items?: PricingItem[];
  summary?: {
    subtotalBase?: number;
    subtotalDiscounted?: number;
    discountAmount?: number;
    autoDiscountAmount?: number;
    codeDiscountAmount?: number;
    freeShipping?: boolean;
    freeShippingPromotionName?: string | null;
  };
  code?: {
    valid?: boolean;
    message?: string;
  };
};

type CheckoutPaymentSettings = {
  mercadopagoEnabled: boolean;
  manualMethods: {
    key: "agreement" | "cash" | "transfer";
    label: string;
    enabled: boolean;
    instructions: string;
    bankDetails?: {
      accountNumber: string;
      cbu: string;
      alias: string;
      holder: string;
      taxId: string;
      accountType: string;
      bank: string;
    };
  }[];
};

type CheckoutCarrier = {
  key: string;
  name: string;
  enabled: boolean;
  custom?: boolean;
  description?: string;
  flatRate?: number;
  pricingMode?: "fixed" | "agreement" | "free";
  deliveryDays?: string | null;
};

const PROVINCES = [
  { code: "A", name: "Salta" },
  { code: "B", name: "Provincia de Buenos Aires" },
  { code: "C", name: "CABA" },
  { code: "D", name: "San Luis" },
  { code: "E", name: "Entre Rios" },
  { code: "F", name: "La Rioja" },
  { code: "G", name: "Santiago del Estero" },
  { code: "H", name: "Chaco" },
  { code: "J", name: "San Juan" },
  { code: "K", name: "Catamarca" },
  { code: "L", name: "La Pampa" },
  { code: "M", name: "Mendoza" },
  { code: "N", name: "Misiones" },
  { code: "P", name: "Formosa" },
  { code: "Q", name: "Neuquen" },
  { code: "R", name: "Rio Negro" },
  { code: "S", name: "Santa Fe" },
  { code: "T", name: "Tucuman" },
  { code: "U", name: "Chubut" },
  { code: "V", name: "Tierra del Fuego" },
  { code: "W", name: "Corrientes" },
  { code: "X", name: "Cordoba" },
  { code: "Y", name: "Jujuy" },
  { code: "Z", name: "Santa Cruz" },
];

function provinceNameFromCode(code: string) {
  const found = PROVINCES.find((p) => p.code === code);
  return found?.name || "";
}

function shippingEstimateLabel(amount: number, freeShipping: boolean) {
  if (freeShipping) return "Estimado Gratis";
  return amount > 0 ? `Estimado $${amount.toLocaleString("es-AR")}` : "Ingresa tu CP para cotizar";
}

function ShippingAmount({ amount, freeShipping }: { amount: number; freeShipping: boolean }) {
  if (freeShipping && amount > 0) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="text-xs font-medium text-zinc-500 line-through">
          ${amount.toLocaleString("es-AR")}
        </span>
        <span className="text-zinc-100">Gratis</span>
      </span>
    );
  }

  return <>{amount > 0 ? `$${amount.toLocaleString("es-AR")}` : "—"}</>;
}

export default function CheckoutClient({ paymentSettings }: { paymentSettings: CheckoutPaymentSettings }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [orderItems, setOrderItems] = useState<CartItem[]>([]);
  const [shipping, setShipping] = useState<Shipping>({
    name: "",
    email: "",
    phone: "",
    addressLine: "",
    city: "",
    province: "",
    provinceCode: "",
    zip: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<number | null>(null);
  const [shippingQuote, setShippingQuote] = useState<EpickQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [andreaniQuote, setAndreaniQuote] = useState<AndreaniQuote | null>(null);
  const [andreaniLoading, setAndreaniLoading] = useState(false);
  const [andreaniError, setAndreaniError] = useState<string | null>(null);
  const [correoQuote, setCorreoQuote] = useState<{ rates?: CorreoRate[] } | null>(null);
  const [correoLoading, setCorreoLoading] = useState(false);
  const [correoError, setCorreoError] = useState<string | null>(null);
  const [correoDeliveryType, setCorreoDeliveryType] = useState<CorreoDeliveryType>("D");
  const [correoAgencies, setCorreoAgencies] = useState<CorreoAgency[]>([]);
  const [correoAgenciesLoading, setCorreoAgenciesLoading] = useState(false);
  const [correoAgenciesError, setCorreoAgenciesError] = useState<string | null>(null);
  const [selectedCorreoAgencyCode, setSelectedCorreoAgencyCode] = useState("");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("epick");
  const [customerNotes, setCustomerNotes] = useState("");
  const [confirmedShipping, setConfirmedShipping] = useState<Shipping | null>(null);
  const firstPaymentMethod =
    paymentSettings.mercadopagoEnabled
      ? "mercadopago"
      : paymentSettings.manualMethods.find((method) => method.enabled)?.key || "agreement";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(firstPaymentMethod);
  const [carriers, setCarriers] = useState<Record<string, boolean> | null>(null);
  const [checkoutCarriers, setCheckoutCarriers] = useState<CheckoutCarrier[]>([]);
  const [promoCode, setPromoCode] = useState("");
  const [pricing, setPricing] = useState<PricingData | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const checkoutTracked = useRef(false);

  useEffect(() => {
    const sync = () => {
      setItems(readCart());
      setPromoCode(readPromoCode());
    };
    sync();

    const syncShipping = () => {
      try {
        const stored = JSON.parse(localStorage.getItem(SELECTED_SHIPPING_KEY) || "null");
        if (!stored?.key) return;
        setShippingMethod(String(stored.key));
        if (stored.postalCode) {
          setShipping((current) => ({
            ...current,
            zip: String(stored.postalCode),
            ...(stored.agencyProvince ? { province: String(stored.agencyProvince) } : {}),
            ...(stored.agencyProvinceCode ? { provinceCode: String(stored.agencyProvinceCode) } : {}),
          }));
        }
        if (stored.key === "correo" && (stored.deliveryType === "D" || stored.deliveryType === "S")) {
          setCorreoDeliveryType(stored.deliveryType);
        }
        if (stored.key === "correo" && stored.agencyCode) {
          setSelectedCorreoAgencyCode(String(stored.agencyCode));
        }
      } catch {
        // Ignorar una selección guardada inválida.
      }
    };
    syncShipping();

    const onChange = () => sync();
    const onShippingChange = () => syncShipping();
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);
    window.addEventListener("shipping:changed", onShippingChange);

    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("shipping:changed", onShippingChange);
    };
  }, []);

  useEffect(() => {
    if (checkoutTracked.current || items.length === 0) return;
    checkoutTracked.current = true;
    trackMetaInitiateCheckout(items.map((item) => ({
      id: item.productVariantId || item.productId,
      price: item.price,
      quantity: item.quantity,
    })));
  }, [items]);

  const summaryItems = orderId ? orderItems : items;
  const subtotalFallback = useMemo(
    () => summaryItems.reduce((acc, it) => acc + it.price * it.quantity, 0),
    [summaryItems]
  );
  const epickAmount = Number(shippingQuote?.price ?? shippingQuote?.total ?? 0);
  const andreaniAmount = Number(andreaniQuote?.tarifaConIva?.total ?? 0);
  const correoRates = Array.isArray(correoQuote?.rates) ? (correoQuote.rates as CorreoRate[]) : [];
  const correoHomeRate = correoRates.find((r) => r?.deliveredType === "D");
  const correoBranchRate = correoRates.find((r) => r?.deliveredType === "S");
  const correoHomeAmount = Number(correoHomeRate?.price ?? 0);
  const correoBranchAmount = Number(correoBranchRate?.price ?? 0);
  const selectedCorreoAgency = correoAgencies.find((agency) => agency.code === selectedCorreoAgencyCode) || null;
  const postalCodeProvinceError = validateArgentinaPostalCodeProvince(shipping.zip, shipping.provinceCode);
  const epickEnabled = carriers ? carriers.epick !== false : true;
  const andreaniEnabled = carriers ? carriers.andreani !== false : true;
  const correoEnabled = carriers ? carriers.correo !== false : true;
  const pickupEnabled = carriers ? carriers.pickup !== false : true;
  const customCarriers = useMemo(
    () => checkoutCarriers.filter((carrier) => carrier.custom && carrier.enabled),
    [checkoutCarriers],
  );
  const selectedCustomCarrier = customCarriers.find((carrier) => carrier.key === shippingMethod) || null;
  const carrierDeliveryDays = (key: string) => checkoutCarriers.find((carrier) => carrier.key === key)?.deliveryDays;
  const deliveryDaysLabel = (key: string) => {
    const days = carrierDeliveryDays(key);
    return days ? `${days} días hábiles luego de ser despachado` : "Luego de ser despachado";
  };
  const selectedShippingIsAgreement = selectedCustomCarrier?.pricingMode === "agreement";
  const promotionDeliveryType =
    shippingMethod === "correo" ? correoDeliveryType : shippingMethod === "pickup" ? null : "D";
  const sortedCorreoAgencies = useMemo(() => {
    const customerZip = shipping.zip.trim();
    if (!customerZip) return correoAgencies;
    return [...correoAgencies].sort((a, b) => {
      const distanceDiff = postalCodeDistance(a.zip, customerZip) - postalCodeDistance(b.zip, customerZip);
      return distanceDiff || a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
    });
  }, [correoAgencies, shipping.zip]);
  const activeCorreoAmount = correoDeliveryType === "S" ? correoBranchAmount : correoHomeAmount;
  const correoBranchNeedsAgency =
    shippingMethod === "correo" && correoDeliveryType === "S" && !selectedCorreoAgency;
  const shippingAmount =
    shippingMethod === "epick"
      ? epickAmount
      : shippingMethod === "andreani"
        ? andreaniAmount
        : shippingMethod === "correo"
          ? activeCorreoAmount
          : selectedCustomCarrier
            ? selectedCustomCarrier.pricingMode === "agreement"
              ? 0
              : Number(selectedCustomCarrier.flatRate || 0)
            : 0;
  const subtotalBase = pricing?.summary?.subtotalBase ?? subtotalFallback;
  const subtotalDiscounted = pricing?.summary?.subtotalDiscounted ?? subtotalFallback;
  const discountAmount = pricing?.summary?.discountAmount ?? 0;
  const autoDiscountAmount = pricing?.summary?.autoDiscountAmount ?? 0;
  const codeDiscountAmount = pricing?.summary?.codeDiscountAmount ?? 0;
  const freeShippingApplies = pricing?.summary?.freeShipping === true;
  const epickFreeShipping = freeShippingApplies && shippingMethod === "epick" && epickAmount > 0;
  const andreaniFreeShipping = freeShippingApplies && shippingMethod === "andreani" && andreaniAmount > 0;
  const correoHomeFreeShipping =
    freeShippingApplies && shippingMethod === "correo" && correoDeliveryType === "D" && correoHomeAmount > 0;
  const correoBranchFreeShipping =
    freeShippingApplies && shippingMethod === "correo" && correoDeliveryType === "S" && correoBranchAmount > 0;
  const activeCorreoFreeShipping = correoDeliveryType === "S" ? correoBranchFreeShipping : correoHomeFreeShipping;
  const effectiveShippingAmount = freeShippingApplies ? 0 : shippingAmount;
  const total = subtotalDiscounted + effectiveShippingAmount;
  const requiresAddress = shippingMethod !== "pickup";
  const branchReady = shippingMethod !== "correo" || correoDeliveryType !== "S" || Boolean(selectedCorreoAgency);
  const enabledManualPaymentMethods = paymentSettings.manualMethods.filter((method) => method.enabled);
  const selectedManualPaymentMethod = enabledManualPaymentMethods.find((method) => method.key === paymentMethod) || null;
  const hasPaymentMethods = paymentSettings.mercadopagoEnabled || enabledManualPaymentMethods.length > 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (summaryItems.length === 0) {
        setPricing(null);
        setPricingError(null);
        return;
      }
      const res = await fetch("/api/promotions/cart-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: summaryItems.map((it) => ({
            productId: it.productId,
            productVariantId: it.productVariantId ?? null,
            lineKey: it.lineKey,
            quantity: it.quantity,
          })),
          promoCode,
          paymentMethod,
          deliveryType: promotionDeliveryType,
          carrierKey: shippingMethod,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setPricingError(data?.error || "No se pudo calcular promociones.");
        setPricing(null);
        return;
      }
      setPricing(data?.pricing || null);
      setPricingError(data?.pricing?.code?.valid === false && promoCode ? data?.pricing?.code?.message : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [summaryItems, promoCode, paymentMethod, promotionDeliveryType, shippingMethod]);

  const pricingById = useMemo(() => {
    const map = new Map<string, PricingItem>();
    for (const it of pricing?.items ?? []) map.set(it.lineKey, it);
    return map;
  }, [pricing]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/shipping/carriers");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (res.ok && Array.isArray(data?.carriers)) {
        const map: Record<string, boolean> = {};
        const list = data.carriers as CheckoutCarrier[];
        for (const c of list) {
          map[String(c.key)] = Boolean(c.enabled);
        }
        setCheckoutCarriers(list);
        setCarriers(map);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!carriers) return;
    const order: ShippingMethod[] = ["epick", "andreani", "correo", "pickup", ...customCarriers.map((carrier) => carrier.key)];
    const isEnabled = (m: ShippingMethod) => carriers[m] !== false;
    if (isEnabled(shippingMethod)) return;
    const next = order.find((m) => isEnabled(m));
    if (!next) return;
    const timer = setTimeout(() => setShippingMethod(next), 0);
    return () => clearTimeout(timer);
  }, [carriers, customCarriers, shippingMethod]);

  useEffect(() => {
    if (!correoEnabled || !shipping.provinceCode.trim()) {
      const timer = setTimeout(() => {
        setCorreoAgencies([]);
        setSelectedCorreoAgencyCode("");
        setCorreoAgenciesError(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setCorreoAgenciesLoading(true);
      setCorreoAgenciesError(null);

      const res = await fetch("/api/shipping/correo-argentino/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provinceCode: shipping.provinceCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;

      setCorreoAgenciesLoading(false);
      if (!res.ok) {
        setCorreoAgencies([]);
        setSelectedCorreoAgencyCode("");
        setCorreoAgenciesError(data?.error || "No se pudieron consultar sucursales.");
        return;
      }

      let agencies = Array.isArray(data?.agencies) ? (data.agencies as CorreoAgency[]) : [];
      try {
        const stored = JSON.parse(localStorage.getItem(SELECTED_SHIPPING_KEY) || "null");
        if (stored?.agencyCode && !agencies.some((agency) => agency.code === stored.agencyCode) && stored.agencyName) {
          agencies = [{
            code: String(stored.agencyCode),
            name: String(stored.agencyName),
            addressLine: String(stored.agencyAddressLine || ""),
            city: String(stored.agencyCity || ""),
            province: String(stored.agencyProvince || ""),
            provinceCode: String(stored.agencyProvinceCode || ""),
            zip: String(stored.agencyZip || ""),
          }, ...agencies];
        }
      } catch {
        // Ignorar selección guardada inválida.
      }
      setCorreoAgencies(agencies);
      setSelectedCorreoAgencyCode((current) => agencies.some((agency) => agency.code === current) ? current : "");
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [shipping.provinceCode, correoEnabled]);

  useEffect(() => {
    const customerPostalCode = shipping.zip.trim();
    const shouldFetchPostalCode =
      shippingMethod === "correo" && correoDeliveryType === "S"
        ? selectedCorreoAgency?.zip?.trim()
        : customerPostalCode;
    const shouldFetchProvinceCode =
      shippingMethod === "correo" && correoDeliveryType === "S"
        ? selectedCorreoAgency?.provinceCode?.trim()
        : shipping.provinceCode.trim();
    const canQuoteEpick = Boolean(customerPostalCode);
    const canQuoteAndreani = Boolean(customerPostalCode);

    if (!shouldFetchPostalCode) return;
    if (
      shouldFetchProvinceCode &&
      validateArgentinaPostalCodeProvince(shouldFetchPostalCode, shouldFetchProvinceCode)
    ) {
      return;
    }

    const t = setTimeout(async () => {
      setQuoteError(null);
      setQuoteLoading(epickEnabled && canQuoteEpick);
      setAndreaniError(null);
      setAndreaniLoading(andreaniEnabled && canQuoteAndreani);
      setCorreoError(null);
      setCorreoLoading(correoEnabled);

      if (!epickEnabled || !canQuoteEpick) {
        setShippingQuote(null);
        setQuoteError(null);
      }
      if (!andreaniEnabled || !canQuoteAndreani) {
        setAndreaniQuote(null);
        setAndreaniError(null);
      }
      if (!correoEnabled) {
        setCorreoQuote(null);
        setCorreoError(null);
      }

      const [epickRes, andreaniRes, correoRes] = await Promise.all([
        epickEnabled && canQuoteEpick
          ? fetch("/api/shipping/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ postalCode: customerPostalCode }),
            })
          : Promise.resolve(null),
        andreaniEnabled && canQuoteAndreani
          ? fetch("/api/shipping/andreani/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ cpDestino: customerPostalCode }),
            })
          : Promise.resolve(null),
        correoEnabled
          ? fetch("/api/shipping/correo-argentino/quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                postalCode: shouldFetchPostalCode,
                provinceCode: shouldFetchProvinceCode,
              }),
            })
          : Promise.resolve(null),
      ]);

      const epickData = epickRes ? await epickRes.json().catch(() => ({})) : null;
      const andreaniData = andreaniRes ? await andreaniRes.json().catch(() => ({})) : null;
      const correoData = correoRes ? await correoRes.json().catch(() => ({})) : null;

      setQuoteLoading(false);
      setAndreaniLoading(false);
      setCorreoLoading(false);

      if (epickRes) {
        if (!epickRes.ok) {
          setQuoteError(epickData?.error || "No se pudo cotizar.");
          setShippingQuote(null);
        } else {
          setShippingQuote(epickData?.quote || null);
        }
      }

      if (andreaniRes) {
        if (!andreaniRes.ok) {
          setAndreaniError(andreaniData?.error || "No se pudo cotizar Andreani.");
          setAndreaniQuote(null);
        } else {
          setAndreaniQuote(andreaniData?.quote || null);
        }
      }

      if (correoRes) {
        if (!correoRes.ok) {
          setCorreoError(correoData?.error || "No se pudo cotizar Correo Argentino.");
          setCorreoQuote(null);
        } else {
          setCorreoQuote(correoData?.quote || null);
        }
      }
    }, 500);

    return () => clearTimeout(t);
  }, [
    shipping.zip,
    shipping.provinceCode,
    shippingMethod,
    correoDeliveryType,
    selectedCorreoAgency?.zip,
    selectedCorreoAgency?.provinceCode,
    epickEnabled,
    andreaniEnabled,
    correoEnabled,
  ]);

  const canSubmit =
    items.length > 0 &&
    hasPaymentMethods &&
    shipping.name.trim() &&
    shipping.email.trim() &&
    shipping.phone.trim() &&
    shipping.provinceCode.trim() &&
    (requiresAddress
      ? shipping.addressLine.trim() &&
        shipping.city.trim() &&
        shipping.province.trim() &&
        shipping.zip.trim() &&
        !postalCodeProvinceError
      : true) &&
    branchReady;

  async function createOrder() {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((it) => ({
            productId: it.productId,
            productVariantId: it.productVariantId ?? null,
            lineKey: it.lineKey,
            quantity: it.quantity,
          })),
          shipping,
          shippingMethod,
          shippingDeliveryType: shippingMethod === "correo" ? correoDeliveryType : undefined,
          shippingBranch:
            shippingMethod === "correo" && correoDeliveryType === "S" && selectedCorreoAgency
              ? selectedCorreoAgency
              : undefined,
          shippingAmount: effectiveShippingAmount,
          paymentMethod,
          promoCode,
          notes: customerNotes,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLoading(false);
        setError(data?.error || "No se pudo crear el pedido.");
        return;
      }

      setOrderItems(items);
      setOrderId(data.orderId);
      setOrderNumber(typeof data.orderNumber === "number" ? data.orderNumber : null);
      setConfirmedShipping(shipping);
      clearCart();
      clearPromoCode();
      setLoading(false);
    } catch {
      setLoading(false);
      setError("Error de red creando el pedido.");
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-semibold">Resumen</h2>

        {summaryItems.length === 0 ? (
          <div className="mt-4 text-zinc-300">
            Tu carrito esta vacio.{" "}
            <Link href="/" className="text-zinc-100 hover:underline">
              Volver a productos
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {summaryItems.map((it) => (
                <div key={it.lineKey} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{it.name}</div>
                    {it.variantLabel ? <div className="mt-1 text-xs text-zinc-500">{it.variantLabel}</div> : null}
                    <div className="mt-1 text-sm text-zinc-400">
                      {(() => {
                        const pi = pricingById.get(it.lineKey);
                        const base = Number(pi?.basePrice ?? it.price);
                        const final = Number(pi?.finalPrice ?? it.price);
                        const percent = Number(pi?.totalPercent ?? 0);
                        if (percent <= 0) return <span>{it.quantity} x ${base.toLocaleString("es-AR")}</span>;
                        return (
                          <div>
                            {it.quantity} x <span className="line-through text-zinc-500">${base.toLocaleString("es-AR")}</span>{" "}
                            ${final.toLocaleString("es-AR")}{" "}
                            <span className="text-xs text-zinc-500">({percent}% OFF)</span>
                            <div className="text-xs text-zinc-500">
                              {Number(pi?.autoPercent ?? 0) > 0 && <span>Promo tienda {pi?.autoPercent}%</span>}
                              {Number(pi?.autoPercent ?? 0) > 0 && Number(pi?.codePercent ?? 0) > 0 && <span> + </span>}
                              {Number(pi?.codePercent ?? 0) > 0 && <span>Codigo {pi?.codePercent}%</span>}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="shrink-0 text-sm text-zinc-200">
                    ${Number(pricingById.get(it.lineKey)?.finalSubtotal ?? it.price * it.quantity).toLocaleString("es-AR")}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>${subtotalBase.toLocaleString("es-AR")}</span>
              </div>
              {discountAmount > 0 && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Descuento</span>
                  <span className="text-amber-300">-${discountAmount.toLocaleString("es-AR")}</span>
                </div>
              )}
              {autoDiscountAmount > 0 && (
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">- Promo tienda</span>
                  <span className="text-zinc-400">-${autoDiscountAmount.toLocaleString("es-AR")}</span>
                </div>
              )}
              {codeDiscountAmount > 0 && (
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">- Codigo promocional</span>
                  <span className="text-zinc-400">-${codeDiscountAmount.toLocaleString("es-AR")}</span>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                <span>Envio</span>
                <span>
                  {selectedShippingIsAgreement
                    ? "A convenir"
                    : shippingMethod === "pickup" || effectiveShippingAmount <= 0
                      ? "Gratis"
                      : `$${effectiveShippingAmount.toLocaleString("es-AR")}`}
                </span>
              </div>
              {freeShippingApplies && shippingMethod !== "pickup" && shippingAmount > 0 && (
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="text-zinc-500">- Envío bonificado</span>
                  <span className="text-zinc-400">-${shippingAmount.toLocaleString("es-AR")}</span>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between">
                <span className="text-zinc-300">Total</span>
                <span className="text-xl font-semibold">${total.toLocaleString("es-AR")}</span>
              </div>
              {promoCode && (
                <div className="mt-2 text-xs text-zinc-500">
                  Codigo: <span className="font-mono text-zinc-300">{promoCode}</span>
                  {pricingError && <span className="ml-2 text-amber-300">({pricingError})</span>}
                </div>
              )}
            </div>

            <div className="mt-5">
              <Link href="/cart" className="text-sm text-zinc-400 hover:text-zinc-200">
                ← Volver al carrito
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <h2 className="text-lg font-semibold">Datos de envio</h2>

        {orderId ? (
          <PayBlock
            orderId={orderId}
            orderNumber={orderNumber}
            shippingMethod={shippingMethod}
            shipping={confirmedShipping || shipping}
            paymentMethod={paymentMethod}
            manualPaymentMethod={selectedManualPaymentMethod}
          />
        ) : (
          <>
            <div className="mt-4 grid gap-3">
              <Field
                label="Nombre y apellido"
                value={shipping.name}
                onChange={(v) => setShipping((s) => ({ ...s, name: v }))}
              />
              <Field
                label="Email"
                type="email"
                value={shipping.email}
                onChange={(v) => setShipping((s) => ({ ...s, email: v }))}
              />
              <Field
                label="Telefono"
                value={shipping.phone}
                onChange={(v) => setShipping((s) => ({ ...s, phone: v }))}
              />

              <>
                <Field
                  label="Direccion"
                  value={shipping.addressLine}
                  onChange={(v) => setShipping((s) => ({ ...s, addressLine: v }))}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Ciudad"
                    value={shipping.city}
                    onChange={(v) => setShipping((s) => ({ ...s, city: v }))}
                  />
                  <Field
                    label="Codigo Postal"
                    value={shipping.zip}
                    onChange={(v) => setShipping((s) => ({ ...s, zip: v }))}
                  />
                </div>
              </>

              <div>
                <label className="text-sm text-zinc-300">Provincia</label>
                <select
                  value={shipping.provinceCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setShipping((s) => ({
                      ...s,
                      provinceCode: code,
                      province: provinceNameFromCode(code),
                    }));
                    setSelectedCorreoAgencyCode("");
                  }}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                >
                  <option value="">Seleccionar</option>
                  {PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {requiresAddress && postalCodeProvinceError && (
                <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                  {postalCodeProvinceError}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-sm font-semibold">Metodo de envio</div>
              <div className="mt-3 grid gap-3">
                {epickEnabled && (
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === "epick"}
                        onChange={() => setShippingMethod("epick")}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/images/epick.png" alt="" className="h-7 w-7 rounded-full object-contain" />
                          <span>Envio a domicilio (E-pick)</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          {deliveryDaysLabel("epick")} · {quoteLoading
                            ? "Cotizando..."
                            : shippingQuote?.price || shippingQuote?.total
                              ? shippingEstimateLabel(Number(shippingQuote.price ?? shippingQuote.total), epickFreeShipping)
                              : "Ingresa tu CP para cotizar"}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      <ShippingAmount amount={epickAmount} freeShipping={epickFreeShipping} />
                    </div>
                  </label>
                )}

                {andreaniEnabled && (
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === "andreani"}
                        onChange={() => setShippingMethod("andreani")}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <ShippingMethodLogo method="andreani" />
                          <span>Envio a domicilio (Andreani)</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          {andreaniLoading
                            ? "Cotizando..."
                            : andreaniQuote?.tarifaConIva?.total
                              ? shippingEstimateLabel(Number(andreaniQuote.tarifaConIva.total), andreaniFreeShipping)
                              : "Ingresa tu CP para cotizar"}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      <ShippingAmount amount={andreaniAmount} freeShipping={andreaniFreeShipping} />
                    </div>
                  </label>
                )}

                {correoEnabled && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <label className="flex cursor-pointer items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={shippingMethod === "correo"}
                          onChange={() => setShippingMethod("correo")}
                          className="mt-1"
                        />
                        <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/images/correo-argentino.png" alt="" className="h-7 w-7 rounded-full object-contain" />
                          <span>Correo Argentino</span>
                        </div>
                        <div className="text-xs text-zinc-500">
                          {deliveryDaysLabel("correo")} · {correoLoading
                            ? "Cotizando..."
                            : correoBranchNeedsAgency
                              ? "Selecciona una sucursal para cotizar"
                            : activeCorreoAmount > 0
                                ? shippingEstimateLabel(activeCorreoAmount, activeCorreoFreeShipping)
                                : "Completa los datos para cotizar"}
                        </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">
                        <ShippingAmount amount={activeCorreoAmount} freeShipping={activeCorreoFreeShipping} />
                      </div>
                    </label>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShippingMethod("correo");
                          setCorreoDeliveryType("D");
                        }}
                        className={[
                          "rounded-xl border px-3 py-2 text-left text-sm",
                          shippingMethod === "correo" && correoDeliveryType === "D"
                            ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                            : "border-zinc-800 bg-zinc-950 text-zinc-200",
                        ].join(" ")}
                      >
                        <div className="font-medium">Domicilio</div>
                        <div className="mt-1 text-xs opacity-80">
                          {correoHomeFreeShipping ? (
                            <span>
                              <span className="line-through">${correoHomeAmount.toLocaleString("es-AR")}</span>{" "}
                              <span className="font-semibold text-zinc-100">Gratis</span>
                            </span>
                          ) : correoHomeAmount > 0 ? (
                            `$${correoHomeAmount.toLocaleString("es-AR")}`
                          ) : (
                            "Sin tarifa"
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShippingMethod("correo");
                          setCorreoDeliveryType("S");
                        }}
                        className={[
                          "rounded-xl border px-3 py-2 text-left text-sm",
                          shippingMethod === "correo" && correoDeliveryType === "S"
                            ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                            : "border-zinc-800 bg-zinc-950 text-zinc-200",
                        ].join(" ")}
                        >
                        <div className="font-medium">Sucursal</div>
                        <div className="mt-1 text-xs opacity-80">
                          {correoBranchNeedsAgency
                            ? "Selecciona sucursal"
                            : correoBranchFreeShipping
                              ? (
                                  <span>
                                    <span className="line-through">${correoBranchAmount.toLocaleString("es-AR")}</span>{" "}
                                    <span className="font-semibold text-white">Gratis</span>
                                  </span>
                                )
                              : correoBranchAmount > 0
                                ? `$${correoBranchAmount.toLocaleString("es-AR")}`
                                : "Sin tarifa"}
                        </div>
                      </button>
                    </div>

                    {shippingMethod === "correo" && correoDeliveryType === "S" && (
                      <div className="mt-3 grid gap-3">
                        <div>
                          <label className="text-sm text-zinc-300">Sucursal Correo Argentino</label>
                          <select
                            value={selectedCorreoAgencyCode}
                            onChange={(e) => setSelectedCorreoAgencyCode(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
                            disabled={!shipping.provinceCode || correoAgenciesLoading}
                          >
                            <option value="">
                              {correoAgenciesLoading ? "Cargando sucursales..." : "Seleccionar sucursal"}
                            </option>
                            {sortedCorreoAgencies.slice(0, 4).map((agency) => (
                              <option key={agency.code} value={agency.code}>
                                {agency.name} - {agency.city} ({agency.zip})
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedCorreoAgency && (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-300">
                            <div className="font-medium">{selectedCorreoAgency.name}</div>
                            <div className="mt-1 text-zinc-400">
                              {selectedCorreoAgency.addressLine}, {selectedCorreoAgency.city}, {selectedCorreoAgency.province} ({selectedCorreoAgency.zip})
                            </div>
                            <div className="mt-1 text-xs text-zinc-500 font-mono">{selectedCorreoAgency.code}</div>
                          </div>
                        )}

                        {correoAgenciesError && (
                          <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                            {correoAgenciesError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {pickupEnabled && (
                  <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="radio"
                        name="shippingMethod"
                        checked={shippingMethod === "pickup"}
                        onChange={() => setShippingMethod("pickup")}
                        className="mt-1"
                      />
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <ShippingMethodLogo method="pickup" />
                          <span>Retiro en comercio</span>
                        </div>
                        <div className="text-xs text-zinc-500">Sin costo de envio</div>
                      </div>
                    </div>
                    <div className="text-sm font-semibold">Gratis</div>
                  </label>
                )}

                {customCarriers.map((carrier) => {
                  const amount = Number(carrier.flatRate || 0);
                  const isAgreement = carrier.pricingMode === "agreement";
                  const customFreeShipping = freeShippingApplies && shippingMethod === carrier.key && amount > 0 && !isAgreement;
                  return (
                    <label key={carrier.key} className="flex cursor-pointer items-start justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={shippingMethod === carrier.key}
                          onChange={() => setShippingMethod(carrier.key)}
                          className="mt-1"
                        />
                        <div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <ShippingMethodLogo method={carrier.key} />
                            <span>{carrier.name}</span>
                          </div>
                          <div className="text-xs text-zinc-500">
                            {isAgreement ? "Coordinamos el costo después de la compra." : carrier.description || "Método de entrega personalizado"}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">
                        {isAgreement ? (
                          "A convenir"
                        ) : amount > 0 ? (
                          <ShippingAmount amount={amount} freeShipping={customFreeShipping} />
                        ) : (
                          "Gratis"
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="text-sm font-semibold">Metodo de pago</div>
              <div className="mt-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/30">
                {paymentSettings.mercadopagoEnabled ? (
                  <PaymentOption
                    checked={paymentMethod === "mercadopago"}
                    onChange={() => setPaymentMethod("mercadopago")}
                    icon={CreditCard}
                    title="Mercado Pago"
                    description="Tarjetas, débito y otros medios."
                    logos={<MercadoPagoLogos />}
                  />
                ) : null}

                {enabledManualPaymentMethods.map((method) => (
                  <PaymentOption
                    key={method.key}
                    checked={paymentMethod === method.key}
                    onChange={() => setPaymentMethod(method.key)}
                    icon={paymentIconFor(method.key)}
                    iconImageUrl={paymentIconImageFor(method.key)}
                    title={paymentLabelFor(method.key, method.label)}
                    description={paymentDescriptionFor(method.key)}
                  />
                ))}

                {!hasPaymentMethods ? (
                  <div className="m-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                    No hay medios de pago activos.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
              <label className="text-sm font-semibold" htmlFor="checkout-notes">
                Notas del pedido
              </label>
              <textarea
                id="checkout-notes"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value.slice(0, 1000))}
                rows={4}
                placeholder="Ej: entregar por la tarde, llamar antes de llegar, aclaraciones sobre el pedido..."
                className="mt-3 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
                <span>Opcional.</span>
                <span>{customerNotes.length}/1000</span>
              </div>
            </div>

            {quoteError && (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {quoteError}
              </div>
            )}
            {andreaniError && (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {andreaniError}
              </div>
            )}
            {correoError && (
              <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {correoError}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <button
              disabled={!canSubmit || loading}
              onClick={createOrder}
              className="mt-6 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Creando pedido..." : "Crear pedido"}
            </button>

            <p className="mt-3 text-xs text-zinc-500">
              Al crear el pedido, reservamos stock. Si no se paga, luego lo liberamos.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function PayBlock({
  orderId,
  orderNumber,
  shippingMethod,
  shipping,
  paymentMethod,
  manualPaymentMethod,
}: {
  orderId: string;
  orderNumber: number | null;
  shippingMethod: ShippingMethod;
  shipping: Shipping;
  paymentMethod: PaymentMethod;
  manualPaymentMethod: CheckoutPaymentSettings["manualMethods"][number] | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [epickError, setEpickError] = useState<string | null>(null);
  const [epickCreated, setEpickCreated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (shippingMethod !== "epick" || epickCreated) return;

    (async () => {
      const res = await fetch("/api/shipping/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, email: shipping.email || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        const detail = typeof data?.details === "string" && data.details.trim() ? data.details.trim() : "";
        setEpickError(detail ? `${data?.error || "No se pudo crear el envio en E-pick."} ${detail}` : data?.error || "No se pudo crear el envio en E-pick.");
        return;
      }
      setEpickCreated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, shipping.email, shippingMethod, epickCreated]);

  if (paymentMethod !== "mercadopago") {
    return (
      <ManualPaymentConfirmation
        orderId={orderId}
        orderNumber={orderNumber}
        shippingMethod={shippingMethod}
        shipping={shipping}
        paymentMethod={paymentMethod}
        manualPaymentMethod={manualPaymentMethod}
        epickError={epickError}
      />
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="font-semibold text-zinc-100">Pedido creado OK</div>
      <div className="mt-2 text-sm text-zinc-300">
        Numero de pedido: <span className="font-mono">{orderNumber ?? orderId}</span>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {epickError && (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {epickError}
        </div>
      )}

      <button
        disabled={loading}
        onClick={async () => {
          setError(null);
          setLoading(true);

          const res = await fetch("/api/payments/mercadopago/create-preference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId, email: shipping.email || undefined }),
          });

          const data = await res.json().catch(() => ({}));
          setLoading(false);

          if (!res.ok) {
            const detail =
              data?.details?.message ||
              data?.details?.error ||
              data?.details?.cause?.[0]?.description ||
              data?.details?.cause?.[0]?.code;
            setError(detail ? `${data?.error || "Error"} (${detail})` : data?.error || "No se pudo iniciar el pago.");
            console.error("MP preference error", data);
            return;
          }

          window.location.href = data.initPoint;
        }}
        className="mt-4 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {loading ? "Redirigiendo..." : "Pagar con Mercado Pago"}
      </button>

      <p className="mt-3 text-xs text-zinc-500">
        Al pagar, Mercado Pago nos notificara por webhook y actualizaremos el estado del pedido automaticamente.
      </p>

      {shippingMethod === "epick" && (
        <p className="mt-2 text-xs text-zinc-500">El envio E-pick se crea automaticamente al generar el pedido.</p>
      )}
    </div>
  );
}

function ManualPaymentConfirmation({
  orderNumber,
  shippingMethod,
  shipping,
  paymentMethod,
  manualPaymentMethod,
  epickError,
}: {
  orderId: string;
  orderNumber: number | null;
  shippingMethod: ShippingMethod;
  shipping: Shipping;
  paymentMethod: PaymentMethod;
  manualPaymentMethod: CheckoutPaymentSettings["manualMethods"][number] | null;
  epickError: string | null;
}) {
  const title = paymentMethod === "transfer" ? "Un paso más." : "Pedido creado.";
  const paymentLabel = manualPaymentMethod?.label || paymentLabelFor(paymentMethod, "Pago manual");
  const baseInstructions = manualPaymentMethod?.instructions || "La tienda te contactará para coordinar el pago.";
  const instructions = paymentMethod === "transfer" ? transferInstructionsWithBankDetails(baseInstructions, manualPaymentMethod?.bankDetails) : baseInstructions;

  return (
    <div className="mt-4 space-y-4">
      <div className="rounded-2xl border border-amber-500 bg-amber-50 p-5 text-amber-950">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 text-amber-600">
            <Clock3 className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <div className="text-lg font-semibold">{title}</div>
            <p className="mt-1 text-sm text-amber-900">
              Tu orden {orderNumber ? `#${orderNumber}` : ""} fue procesada.
            </p>
            <p className="mt-4 text-sm">
              {paymentMethod === "transfer"
                ? "Utilizá los datos de transferencia bancaria que figuran debajo para hacer el pago."
                : instructions}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
        <h3 className="font-semibold text-zinc-100">
          {paymentMethod === "transfer" ? "Datos para transferencia" : paymentLabel}
        </h3>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{instructions}</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5">
        <h3 className="font-semibold text-zinc-100">Información de tu compra</h3>
        <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
          <InfoItem label="Método de envío" value={shippingMethodLabel(shippingMethod)} />
          <InfoItem label="Estado del envío" value="Pendiente" />
          <InfoItem label="Destinatario" value={`${shipping.name}${shipping.email ? `\nEmail: ${shipping.email}` : ""}${shipping.phone ? `\nTel: ${shipping.phone}` : ""}`} />
          <InfoItem label="Método de pago" value={paymentLabel} />
          <InfoItem
            label="Domicilio"
            value={
              shippingMethod === "pickup"
                ? "Retiro en comercio"
                : `${shipping.addressLine}, ${shipping.city}, ${shipping.province}, CP${shipping.zip}`
            }
          />
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Mail className="h-4 w-4" aria-hidden="true" />
        <span>Te enviamos un email con el detalle del pedido.</span>
      </div>

      {epickError ? (
        <div className="rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {epickError}
        </div>
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-zinc-200">{label}</div>
      <div className="mt-2 whitespace-pre-wrap text-zinc-400">{value || "—"}</div>
    </div>
  );
}

function shippingMethodLabel(method: ShippingMethod) {
  if (method === "epick") return "E-pick";
  if (method === "andreani") return "Andreani";
  if (method === "correo") return "Correo Argentino";
  if (method === "pickup") return "Retiro en comercio";
  return "Envío personalizado";
}

const SHIPPING_LOGO_BASE_URL = "https://dk0k1i3js6c49.cloudfront.net/iconos-envio";

function shippingLogoUrl(method: string) {
  if (method === "epick") return "/images/epick.png";
  if (method === "correo") return "/images/correo-argentino.png";
  if (method === "andreani") return `${SHIPPING_LOGO_BASE_URL}/andreani.png`;
  if (method === "pickup") return `${SHIPPING_LOGO_BASE_URL}/acordar.png`;
  return `${SHIPPING_LOGO_BASE_URL}/personalizado.png`;
}

function ShippingMethodLogo({ method }: { method: string }) {
  return (
    <Image
      src={shippingLogoUrl(method)}
      alt=""
      width={28}
      height={28}
      unoptimized
      className="h-7 w-7 rounded-full object-contain"
    />
  );
}

function paymentIconFor(method: PaymentMethod): LucideIcon {
  if (method === "transfer") return Landmark;
  if (method === "cash") return Banknote;
  return Handshake;
}

function paymentIconImageFor(method: PaymentMethod) {
  if (method === "agreement") return "https://dk0k1i3js6c49.cloudfront.net/iconos-envio/acordar.png";
  return null;
}

function paymentLabelFor(method: PaymentMethod, fallback: string) {
  if (method === "agreement") return "Acordar";
  return fallback;
}

function paymentDescriptionFor(method: PaymentMethod) {
  if (method === "transfer") return "Enviá el comprobante para confirmar tu compra.";
  if (method === "cash") return "Pagás en efectivo al retirar o según lo acordado.";
  if (method === "agreement") return "Nos contactamos para coordinar el pago.";
  return "";
}

function PaymentOption({
  checked,
  onChange,
  icon: Icon,
  title,
  description,
  logos,
  iconImageUrl,
}: {
  checked: boolean;
  onChange: () => void;
  icon: LucideIcon;
  title: string;
  description: string;
  logos?: ReactNode;
  iconImageUrl?: string | null;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-center gap-3 border-b border-zinc-800 px-3 py-3 last:border-b-0",
        checked ? "bg-zinc-900/50" : "bg-transparent hover:bg-zinc-900/30",
      ].join(" ")}
    >
      <input
        type="radio"
        name="paymentMethod"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0"
      />
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-zinc-100">
        {iconImageUrl ? (
          <Image src={iconImageUrl} alt="" width={28} height={28} unoptimized className="max-h-7 w-auto object-contain" aria-hidden="true" />
        ) : (
          <Icon className="h-6 w-6" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-zinc-100">{title}</span>
        {description ? <span className="mt-1 block text-xs leading-4 text-zinc-500">{description}</span> : null}
        {logos ? <span className="mt-2 flex flex-wrap items-center gap-1.5">{logos}</span> : null}
      </span>
    </label>
  );
}

function MercadoPagoLogos() {
  const logos = [
    { label: "GOcuotas", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/5.png" },
    { label: "Mastercard", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/mastercard.png" },
    { label: "Visa", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/visa.png" },
    { label: "American Express", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/american-express.png" },
    { label: "Naranja", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/naranja.png" },
    { label: "Cabal", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/cabal.png" },
    { label: "Maestro", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/maestro.png" },
    { label: "Diners Club", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/diners-club.png" },
    { label: "Nativa", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/nativa.png" },
    { label: "Argencard", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/argencard.png" },
    { label: "Pago Fácil", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/pagofacil.png" },
    { label: "Rapipago", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/rapipago.png" },
  ];

  return (
    <>
      {logos.map((logo) => (
        <span key={logo.url} className="inline-flex h-6 w-10 items-center justify-center rounded border border-zinc-300 bg-white px-1 shadow-sm">
          <Image src={logo.url} alt={logo.label} width={32} height={16} unoptimized className="max-h-4 w-auto object-contain" />
        </span>
      ))}
    </>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-sm text-zinc-300">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
      />
    </div>
  );
}
