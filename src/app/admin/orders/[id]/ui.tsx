"use client";

import Link from "next/link";
import { Building2, Check, CreditCard, FileText, Mail, MapPin, PackageCheck, Phone, Printer, Truck, Undo2, UserRound, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { formatWhatsappMessage, whatsappHref } from "@/lib/whatsapp";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

type PriceValue = number | string | { toString(): string };

type OrderPayment = {
  provider?: string | null;
  status?: string | null;
  paymentId?: string | null;
};

type OrderUser = {
  name?: string | null;
  email?: string | null;
};

type OrderItem = {
  id: string;
  nameSnapshot: string;
  quantity: number;
  unitPrice: PriceValue;
  subtotal: PriceValue;
  product?: {
    images?: { url: string }[];
  } | null;
};

type EPickShipmentState = {
  status?: string | null;
  epickOrderId?: string | null;
  senderCode?: string | null;
  mpUrl?: string | null;
};

type CorreoShipmentState = {
  status?: string | null;
  shippingId?: string | null;
};

type CorreoTrackingEvent = {
  event?: string | null;
  date?: string | null;
  branch?: string | null;
  status?: string | null;
};

type CorreoTrackingRow = {
  trackingNumber?: string | null;
  events?: CorreoTrackingEvent[];
};

type AdminOrder = {
  id: string;
  orderNumber: number;
  status: string;
  total: PriceValue;
  createdAt: string | Date;
  shippedAt?: string | Date | null;
  deliveredAt?: string | Date | null;
  merchantNotes?: string | null;
  contactEmail?: string | null;
  dni?: string | null;
  billingName?: string | null;
  billingPhone?: string | null;
  billingAddressLine?: string | null;
  billingFloor?: string | null;
  billingApartment?: string | null;
  billingCity?: string | null;
  billingProvince?: string | null;
  billingZip?: string | null;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddressLine?: string | null;
  shippingFloor?: string | null;
  shippingApartment?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingZip?: string | null;
  shippingAmount?: PriceValue | null;
  shippingMethod?: string | null;
  shippingDeliveryType?: string | null;
  shippingBranchName?: string | null;
  shippingBranchCode?: string | null;
  notes?: string | null;
  user?: OrderUser | null;
  items: OrderItem[];
  payments?: OrderPayment[];
  epickShipment?: EPickShipmentState | null;
  correoShipment?: CorreoShipmentState | null;
};

const CANCELLABLE_STATUSES = new Set(["pending_payment", "paid", "shipped", "delivered"]);

function translateOrderStatus(status: string) {
  const map: Record<string, string> = {
    pending_payment: "Pendiente de pago",
    paid: "Pagado",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
  };
  return map[status] ?? status;
}

function translatePaymentStatus(status?: string | null) {
  const map: Record<string, string> = {
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
    unknown: "Sin confirmar",
  };
  if (!status) return "Sin pago";
  return map[status] ?? status;
}

function paymentMethodLabel(method?: string | null) {
  const value = String(method || "").trim().toLowerCase();
  const map: Record<string, string> = {
    mercadopago: "Mercado Pago",
    transfer: "Transferencia",
    cash: "Efectivo",
    agreement: "A convenir",
  };
  return map[value] ?? (method || "No informado");
}

function shippingMethodLabel(order: Pick<AdminOrder, "shippingMethod" | "shippingDeliveryType" | "shippingBranchName">) {
  if (order.shippingMethod === "epick") return "Envío a domicilio (E-pick)";
  if (order.shippingMethod === "andreani") return "Envío a domicilio (Andreani)";
  if (order.shippingMethod === "correo") {
    return order.shippingDeliveryType === "S"
      ? `Correo Argentino - Sucursal${order.shippingBranchName ? ` (${order.shippingBranchName})` : ""}`
      : "Correo Argentino - Domicilio";
  }
  if (order.shippingMethod === "pickup") return "Retiro en tienda";
  return order.shippingMethod || "No informado";
}

export default function AdminOrderDetail({ order, whatsappMessageTemplate, shippingCarrier }: {
  order: AdminOrder;
  whatsappMessageTemplate: string;
  shippingCarrier?: { name: string; pricingMode: "fixed" | "agreement" | "free" };
}) {
  const [status, setStatus] = useState<string>(order.status);
  const [paymentStatus, setPaymentStatus] = useState<string>(order.payments?.[0]?.status ?? "—");
  const [shippedAt, setShippedAt] = useState<string | null>(order.shippedAt ? String(order.shippedAt) : null);
  const [deliveredAt, setDeliveredAt] = useState<string | null>(order.deliveredAt ? String(order.deliveredAt) : null);
  const [paidLoading, setPaidLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [shipLoading, setShipLoading] = useState(false);
  const [deliverLoading, setDeliverLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [epick, setEpick] = useState<EPickShipmentState | null>(order.epickShipment ?? null);
  const [epickMsg, setEpickMsg] = useState<string | null>(null);
  const [correo, setCorreo] = useState<CorreoShipmentState | null>(order.correoShipment ?? null);
  const [correoMsg, setCorreoMsg] = useState<string | null>(null);
  const [correoLoading, setCorreoLoading] = useState(false);
  const [correoTracking, setCorreoTracking] = useState<CorreoTrackingRow[] | null>(null);
  const [shipEmailOpen, setShipEmailOpen] = useState(false);
  const [shipEmailMessage, setShipEmailMessage] = useState("");
  const [shipEmailPreview, setShipEmailPreview] = useState<{ to?: string; subject?: string; html?: string } | null>(null);
  const [shipEmailLoading, setShipEmailLoading] = useState(false);
  const [shipEmailMsg, setShipEmailMsg] = useState<string | null>(null);
  const [merchantNotes, setMerchantNotes] = useState(order.merchantNotes || "");
  const [savedMerchantNotes, setSavedMerchantNotes] = useState(order.merchantNotes || "");
  const [merchantNotesLoading, setMerchantNotesLoading] = useState(false);
  const [merchantNotesMsg, setMerchantNotesMsg] = useState<string | null>(null);
  const [printOrderOpen, setPrintOrderOpen] = useState(false);

  const lastPayment = order.payments?.[0];
  const itemsSubtotal = order.items.reduce(
    (acc: number, it) => acc + Number(it.subtotal || 0),
    0
  );
  const shippingAmount = Number(order.shippingAmount || 0);
  const shippingCostLabel = shippingAmount > 0
    ? money(shippingAmount)
    : shippingCarrier?.pricingMode === "agreement" ? "A convenir" : "Gratis";
  const isCorreoShipping = order.shippingMethod === "correo";
  const isEpickShipping = order.shippingMethod === "epick";
  const isBranchShipping = order.shippingDeliveryType === "S" || Boolean(order.shippingBranchCode || order.shippingBranchName);
  const isStorePickup = order.shippingMethod === "pickup";
  const billingName = order.billingName || order.shippingName || order.user?.name || "—";
  const billingPhone = order.billingPhone || order.shippingPhone || "—";
  const billingAddressLine = order.billingAddressLine || order.shippingAddressLine || "";
  const billingFloorApartment = [order.billingFloor, order.billingApartment].filter(Boolean).join(" / ");
  const billingCity = order.billingCity || order.shippingCity || "";
  const billingProvince = order.billingProvince || order.shippingProvince || "";
  const billingZip = order.billingZip || order.shippingZip || "";
  const customerPhone = order.shippingPhone || "";
  const customerName = (order.shippingName || order.user?.name || "").trim();
  const whatsappMessage = formatWhatsappMessage(whatsappMessageTemplate, customerName, order.orderNumber);
  const customerEmail = order.contactEmail || order.user?.email || "";
  const billingRows = [
    ["Nombre", billingName],
    ["Teléfono", billingPhone],
    ["Email", customerEmail || "—"],
    ["DNI", order.dni || "—"],
    ["Dirección", billingAddressLine || "—"],
    ["Piso/Depto", billingFloorApartment || "—"],
    ["Código postal", billingZip || "—"],
    ["Localidad", billingCity || "—"],
    ["Provincia", billingProvince || "—"],
    ["País", "Argentina"],
  ];

  async function loadShipEmailPreview(customMessage = shipEmailMessage) {
    setShipEmailMsg(null);
    setShipEmailLoading(true);
    const res = await fetch(`/api/admin/orders/${order.id}/ship-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preview", customMessage }),
    });
    const data = await res.json().catch(() => ({}));
    setShipEmailLoading(false);
    if (!res.ok) {
      setShipEmailMsg(data?.error || "No se pudo generar el preview del mail.");
      return;
    }
    setShipEmailPreview({ to: data.to, subject: data.subject, html: data.html });
  }

  async function sendShipEmail() {
    setShipEmailMsg(null);
    setShipEmailLoading(true);
    const res = await fetch(`/api/admin/orders/${order.id}/ship-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", customMessage: shipEmailMessage }),
    });
    const data = await res.json().catch(() => ({}));
    setShipEmailLoading(false);
    if (!res.ok) {
      setShipEmailMsg(data?.error || "No se pudo enviar el mail.");
      return;
    }
    setShipEmailMsg("✅ Mail de pedido enviado enviado al cliente.");
  }

  async function saveMerchantNotes() {
    setMerchantNotesMsg(null);
    setMerchantNotesLoading(true);
    const res = await fetch(`/api/admin/orders/${order.id}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantNotes }),
    });
    const data = await res.json().catch(() => ({}));
    setMerchantNotesLoading(false);
    if (!res.ok) {
      setMerchantNotesMsg(data?.error || "No se pudo guardar la nota.");
      return;
    }
    const nextNotes = data?.order?.merchantNotes || "";
    setMerchantNotes(nextNotes);
    setSavedMerchantNotes(nextNotes);
    setMerchantNotesMsg("Nota guardada.");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center justify-between">
          <Link href="/admin/orders" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Volver
          </Link>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Tienda
          </Link>
        </div>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold">Pedido #{order.orderNumber}</h1>
                <button
                  type="button"
                  onClick={() => setPrintOrderOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Imprimir Orden
                </button>
              </div>
              <div className="mt-2 text-xs text-zinc-500">
                {new Date(order.createdAt).toLocaleString("es-AR")}
              </div>
            </div>

            <div className="text-right">
              <Badge label={`Orden: ${translateOrderStatus(status)}`} />
              <div className="mt-2 text-sm text-zinc-300">
                Total: <span className="font-semibold">{money(Number(order.total))}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Pago: {translatePaymentStatus(paymentStatus)} {lastPayment?.paymentId ? `(${lastPayment.paymentId})` : ""}
              </div>
              {shippedAt && (
                <div className="mt-1 text-xs text-zinc-400">
                  Enviado: {new Date(shippedAt).toLocaleString("es-AR")}
                </div>
              )}
              {deliveredAt && (
                <div className="mt-1 text-xs text-zinc-400">
                  Entregado: {new Date(deliveredAt).toLocaleString("es-AR")}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <InfoCard icon={<UserRound className="h-5 w-5" />} title="Cliente">
              <InfoLine icon={<UserRound className="h-4 w-4" />} value={order.shippingName || order.user?.name || "—"} />
              <InfoLine icon={<Phone className="h-4 w-4" />} value={customerPhone || "—"} href={customerPhone ? whatsappHref(customerPhone, whatsappMessage) : undefined} external />
              <InfoLine icon={<Mail className="h-4 w-4" />} value={customerEmail || "—"} href={customerEmail ? `mailto:${customerEmail}` : undefined} />
              <InfoLine icon={<FileText className="h-4 w-4" />} value={`DNI ${order.dni || "—"}`} />
            </InfoCard>

            <InfoCard icon={<Building2 className="h-5 w-5" />} title="Facturación">
              <InfoLine icon={<UserRound className="h-4 w-4" />} value={billingName} />
              <InfoLine icon={<Phone className="h-4 w-4" />} value={billingPhone} />
              <InfoLine icon={<FileText className="h-4 w-4" />} value={`DNI ${order.dni || "—"}`} />
              <InfoLine icon={<MapPin className="h-4 w-4" />} value={`Dirección: ${billingAddressLine || "—"}`} />
              <InfoLine muted icon={<Building2 className="h-4 w-4" />} value={`Piso/Depto: ${billingFloorApartment || "—"}`} />
              <InfoLine muted icon={<MapPin className="h-4 w-4" />} value={`CP ${billingZip || "—"} · ${billingCity || "—"}, ${billingProvince || "—"}`} />
              <InfoLine muted icon={<FileText className="h-4 w-4" />} value="País: Argentina" />
            </InfoCard>

            <InfoCard icon={<Truck className="h-5 w-5" />} title="Envío">
              <div className="mb-5 inline-flex rounded-full bg-[#f1e5d8] px-3 py-1.5 text-xs font-medium text-[#7b4a24]">
                {order.shippingMethod?.startsWith("custom-") && shippingCarrier ? shippingCarrier.name : shippingMethodLabel(order)}
              </div>
              {isBranchShipping ? (
                <>
                  <InfoLine icon={<MapPin className="h-4 w-4" />} value={`Sucursal / punto de retiro: ${order.shippingBranchName || "No informado"}`} />
                  {order.shippingBranchCode ? (
                    <InfoLine muted icon={<Building2 className="h-4 w-4" />} value={`Código de sucursal: ${order.shippingBranchCode}`} />
                  ) : null}
                </>
              ) : isStorePickup ? (
                <InfoLine icon={<MapPin className="h-4 w-4" />} value="Retiro en tienda" />
              ) : (
                <>
                  <InfoLine
                    icon={<MapPin className="h-4 w-4" />}
                    value={`${order.shippingAddressLine || "—"}, ${order.shippingCity || "—"}, ${order.shippingProvince || "—"} · CP ${order.shippingZip || "—"}`}
                  />
                  <InfoLine
                    muted
                    icon={<Building2 className="h-4 w-4" />}
                    value={`Piso/Depto: ${[order.shippingFloor, order.shippingApartment].filter(Boolean).join(" / ") || "—"}`}
                  />
                </>
              )}
              <InfoLine muted icon={<FileText className="h-4 w-4" />} value={`Indicaciones: ${order.notes || "—"}`} />
            </InfoCard>

            <InfoCard icon={<CreditCard className="h-5 w-5" />} title="Pago">
              <div className="text-base font-medium text-zinc-100">{paymentMethodLabel(lastPayment?.provider)}</div>
              <div className="mt-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                {translatePaymentStatus(paymentStatus)}
              </div>
              <div className="my-5 border-t border-zinc-800" />
              <div className="flex items-center justify-between text-base font-semibold text-zinc-100">
                <span>Total</span>
                <span>{money(Number(order.total))}</span>
              </div>
              <div className="mt-4 space-y-2 text-sm text-zinc-400">
                <div className="flex justify-between"><span>Productos</span><span>{money(itemsSubtotal)}</span></div>
                <div className="flex justify-between"><span>Envío</span><span>{shippingCostLabel}</span></div>
                <div className="flex justify-between"><span>Descuento</span><span>$0</span></div>
              </div>
            </InfoCard>
          </div>

          {order.notes ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="text-sm font-semibold">Notas</div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{order.notes}</p>
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
            <div className="text-sm font-semibold">Items</div>
            <div className="mt-3 space-y-3">
              {order.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                      {it.product?.images?.[0]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.product.images[0].url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-zinc-600">
                          <PackageCheck className="h-5 w-5" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium">{it.nameSnapshot}</div>
                      <div className="mt-1 text-sm text-zinc-400">
                        {it.quantity} × {money(Number(it.unitPrice))}
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-zinc-200">{money(Number(it.subtotal))}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span>Subtotal</span>
                <span>{money(itemsSubtotal)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-zinc-400">
                <span>Envío</span>
                <span>{shippingCostLabel}</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-zinc-300">Total</span>
                <span className="text-lg font-semibold">{money(Number(order.total))}</span>
              </div>
            </div>
          </div>

          {msg && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-200">
              {msg}
            </div>
          )}

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ActionCardButton
              title={paidLoading ? "Marcando..." : "Marcar como pagado"}
              description="El pedido fue pagado correctamente."
              icon={<Check className="h-4 w-4" />}
              tone="success"
              disabled={paidLoading || status !== "pending_payment"}
              onClick={async () => {
                setMsg(null);
                setPaidLoading(true);

                const res = await fetch(`/api/admin/orders/${order.id}/paid`, { method: "POST" });
                const data = await res.json().catch(() => ({}));

                setPaidLoading(false);

                if (!res.ok) {
                  setMsg(data?.error || "No se pudo marcar como pagado.");
                  return;
                }

                setStatus(data.order.status);
                setPaymentStatus(data.payment?.status || "approved");
                setMsg("✅ Pedido marcado como pagado.");
              }}
            />

            <ActionCardButton
              title={shipLoading ? "Marcando..." : "Marcar como enviado"}
              description="El pedido fue enviado al cliente."
              icon={<Truck className="h-4 w-4" />}
              tone="sand"
              disabled={shipLoading || status !== "paid"}
              onClick={async () => {
                setMsg(null);
                setShipLoading(true);

                const res = await fetch(`/api/admin/orders/${order.id}/ship`, { method: "POST" });
                const data = await res.json().catch(() => ({}));

                setShipLoading(false);

                if (!res.ok) {
                  setMsg(data?.error || "No se pudo marcar como enviado.");
                  return;
                }

                setStatus(data.order.status);
                setShippedAt(data.order.shippedAt);
                setMsg("✅ Pedido marcado como enviado. El mail todavía no se envió: revisalo y agregá el seguimiento antes de enviarlo.");
                setShipEmailOpen(true);
                await loadShipEmailPreview("");
              }}
            />

            <ActionCardButton
              title={deliverLoading ? "Marcando..." : "Marcar como entregado"}
              description="El pedido fue entregado al cliente."
              icon={<PackageCheck className="h-4 w-4" />}
              tone="warning"
              disabled={deliverLoading || !["paid", "shipped"].includes(status)}
              onClick={async () => {
                setMsg(null);
                setDeliverLoading(true);

                const res = await fetch(`/api/admin/orders/${order.id}/deliver`, { method: "POST" });
                const data = await res.json().catch(() => ({}));

                setDeliverLoading(false);

                if (!res.ok) {
                  setMsg(data?.error || "No se pudo marcar como entregado.");
                  return;
                }

                setStatus(data.order.status);
                setDeliveredAt(data.order.deliveredAt ? String(data.order.deliveredAt) : new Date().toISOString());
                setMsg("✅ Pedido marcado como entregado.");
              }}
            />

            <ActionCardButton
              title={cancelLoading ? "Cancelando..." : "Cancelar pedido"}
              description="Cancelá el pedido y registrá el motivo."
              icon={<X className="h-4 w-4" />}
              tone="danger"
              disabled={cancelLoading || !CANCELLABLE_STATUSES.has(status)}
              onClick={async () => {
                const ok = window.confirm("¿Cancelar este pedido? Se restaurará el stock de sus productos.");
                if (!ok) return;

                setMsg(null);
                setCancelLoading(true);

                const res = await fetch(`/api/admin/orders/${order.id}/cancel`, { method: "POST" });
                const data = await res.json().catch(() => ({}));

                setCancelLoading(false);

                if (!res.ok) {
                  setMsg(data?.error || "No se pudo cancelar el pedido.");
                  return;
                }

                setStatus(data.order.status);
                setMsg("✅ Pedido cancelado.");
              }}
            />

            <ActionCardLink
              href="/admin/orders"
              title="Volver a pedidos"
              description="Regresá al listado de pedidos."
              icon={<Undo2 className="h-4 w-4" />}
            />
          </div>

          {(status !== "paid" || !["paid", "shipped"].includes(status)) && (
            <p className="mt-3 text-xs text-zinc-500">
              * “Marcar como enviado” requiere estado <b>Pagado</b>. “Marcar como entregado” permite <b>Pagado</b> o <b>Enviado</b>.
            </p>
          )}

          {shipEmailOpen && (
            <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">Mail de pedido enviado</h2>
                  <p className="mt-1 text-xs text-zinc-500">
                    Agregá el número o enlace de seguimiento y revisá el contenido. El mail se envía únicamente al tocar “Enviar mail”.
                  </p>
                </div>
                {shipEmailPreview?.to ? (
                  <div className="text-right text-xs text-zinc-500">
                    Para: <span className="text-zinc-300">{shipEmailPreview.to}</span>
                  </div>
                ) : null}
              </div>

              <label className="mt-4 block text-sm text-zinc-300">
                Mensaje adicional / seguimiento
                <textarea
                  value={shipEmailMessage}
                  onChange={(event) => setShipEmailMessage(event.target.value)}
                  placeholder="Ej: Tu número de seguimiento es 123456789. Podés seguir tu envío en: https://..."
                  maxLength={2000}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
                />
              </label>

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={shipEmailLoading}
                  onClick={() => loadShipEmailPreview()}
                  className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
                >
                  {shipEmailLoading ? "Actualizando..." : "Actualizar preview"}
                </button>
                <button
                  type="button"
                  disabled={shipEmailLoading || !shipEmailPreview}
                  onClick={sendShipEmail}
                  className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  {shipEmailLoading ? "Enviando..." : "Enviar mail"}
                </button>
              </div>

              {shipEmailMsg ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-200">
                  {shipEmailMsg}
                </div>
              ) : null}

              {shipEmailPreview ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-white text-zinc-900">
                  <div className="border-b border-zinc-200 px-4 py-3 text-sm">
                    <div className="font-semibold">Asunto</div>
                    <div className="mt-1 text-zinc-700">{shipEmailPreview.subject}</div>
                  </div>
                  <iframe
                    title="Preview mail pedido enviado"
                    srcDoc={shipEmailPreview.html || ""}
                    className="h-[460px] w-full bg-white"
                  />
                </div>
              ) : null}
            </section>
          )}

          <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">Notas internas del pedido</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Anotaciones para el merchant. No se muestran al cliente.
                </p>
              </div>
              {savedMerchantNotes !== merchantNotes ? (
                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">Sin guardar</span>
              ) : null}
            </div>
            <textarea
              value={merchantNotes}
              onChange={(event) => setMerchantNotes(event.target.value)}
              placeholder="Ej: cliente pidió cambio de talle, coordinar retiro por la tarde, revisar stock antes de preparar..."
              rows={5}
              maxLength={5000}
              className="mt-4 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-zinc-500">{merchantNotes.length}/5000</div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={merchantNotesLoading || savedMerchantNotes === merchantNotes}
                  onClick={() => {
                    setMerchantNotes(savedMerchantNotes);
                    setMerchantNotesMsg(null);
                  }}
                  className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={merchantNotesLoading || savedMerchantNotes === merchantNotes}
                  onClick={saveMerchantNotes}
                  className="rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  {merchantNotesLoading ? "Guardando..." : "Guardar nota"}
                </button>
              </div>
            </div>
            {merchantNotesMsg ? (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm text-zinc-200">
                {merchantNotesMsg}
              </div>
            ) : null}
          </section>
        </div>

        {isCorreoShipping && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Envío (Correo Argentino)</div>
              <div className="mt-1 text-xs text-zinc-500">
                Estado: <span className="text-zinc-200">{correo?.status ?? "—"}</span>
              </div>
            </div>
            <a
              href="https://www.correoargentino.com.ar/MiCorreo"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Abrir MiCorreo
            </a>
          </div>

          {correo?.shippingId && (
            <div className="mt-3 text-xs text-zinc-500 font-mono">ShippingId: {correo.shippingId}</div>
          )}

          {correoMsg && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-200">
              {correoMsg}
            </div>
          )}

          {correoTracking && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-200">
              <div className="font-semibold">Tracking Correo</div>
              {correoTracking.map((row, index) => (
                <div key={`${row.trackingNumber || "tracking"}-${index}`} className="mt-3">
                  <div className="font-mono text-xs text-zinc-400">
                    {row.trackingNumber || correo?.shippingId || "Sin número"}
                  </div>
                  <div className="mt-2 space-y-2">
                    {(row.events || []).slice(0, 4).map((event, eventIndex) => (
                      <div key={`${event.event || "event"}-${eventIndex}`} className="text-xs text-zinc-400">
                        <span className="text-zinc-200">{event.event || event.status || "Evento"}</span>
                        {event.date ? ` · ${event.date}` : ""}
                        {event.branch ? ` · ${event.branch}` : ""}
                      </div>
                    ))}
                    {(row.events || []).length === 0 && (
                      <div className="text-xs text-zinc-500">Sin eventos informados todavía.</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              disabled={correoLoading}
              onClick={async () => {
                setCorreoMsg(null);
                setCorreoLoading(true);
                const res = await fetch(`/api/admin/orders/${order.id}/correo/import`, { method: "POST" });
                const data = await res.json().catch(() => ({}));
                setCorreoLoading(false);
                if (!res.ok) {
                  setCorreoMsg(data?.error || "No se pudo importar el envío.");
                  return;
                }
                setCorreo(data.shipment);
                setCorreoMsg(data.reused ? "✅ Envío existente cargado." : "✅ Envío importado.");
              }}
              className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60"
            >
              {correoLoading ? "Importando..." : correo ? "Reimportar envío" : "Importar envío"}
            </button>

            <button
              disabled={correoLoading || !correo}
              onClick={async () => {
                setCorreoMsg(null);
                setCorreoLoading(true);
                const res = await fetch(`/api/admin/orders/${order.id}/correo/tracking`, { method: "GET" });
                const data = await res.json().catch(() => ({}));
                setCorreoLoading(false);
                if (!res.ok) {
                  setCorreoMsg(data?.error || "No se pudo consultar tracking de Correo.");
                  return;
                }
                setCorreo(data.shipment);
                const rows = Array.isArray(data.tracking) ? data.tracking : [data.tracking].filter(Boolean);
                setCorreoTracking(rows);
                setCorreoMsg("✅ Tracking de Correo actualizado.");
              }}
              className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
            >
              {correoLoading ? "Consultando..." : "Consultar tracking"}
            </button>

            <button
              disabled={
                correoLoading ||
                !correo ||
                correo?.status === "CANCELLED_LOCAL" ||
                correo?.status === "CANCELLED"
              }
              onClick={async () => {
                const ok = window.confirm(
                  "Esto solo marca el envío como cancelado en la tienda. Para cancelarlo en Correo Argentino, hacelo también desde el portal MiCorreo."
                );
                if (!ok) return;

                setCorreoMsg(null);
                setCorreoLoading(true);
                const res = await fetch(`/api/admin/orders/${order.id}/correo/cancel`, { method: "POST" });
                const data = await res.json().catch(() => ({}));
                setCorreoLoading(false);
                if (!res.ok) {
                  setCorreoMsg(data?.error || "No se pudo cancelar el envío.");
                  return;
                }
                setCorreo(data.shipment);
                setCorreoMsg(
                  data.reused
                    ? "El envío ya estaba marcado como cancelado localmente."
                    : "✅ Envío marcado como cancelado localmente. Para anularlo en Correo Argentino, usá el portal MiCorreo."
                );
              }}
              className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              {correoLoading ? "Procesando..." : "Marcar cancelado local"}
            </button>
          </div>
        </div>
        )}

        {isEpickShipping && (
        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Envío (E-pick)</div>
              <div className="mt-1 text-xs text-zinc-500">
                Estado: <span className="text-zinc-200">{epick?.status ?? "—"}</span>
              </div>
            </div>
            {epick?.epickOrderId && (
              <a
                href={`https://dev-ar.e-pick.com.ar/tracking?id=${epick.epickOrderId}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Tracking público
              </a>
            )}
          </div>

          {epick?.epickOrderId && (
            <div className="mt-3 text-xs text-zinc-500 font-mono">
              {epick.epickOrderId} · {epick.senderCode}
            </div>
          )}

          {epickMsg && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm text-zinc-200">
              {epickMsg}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              disabled={shipLoading}
              onClick={async () => {
                setEpickMsg(null);
                setShipLoading(true);
                const res = await fetch("/api/shipping/create", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ orderId: order.id }),
                });
                const data = await res.json().catch(() => ({}));
                setShipLoading(false);
                if (!res.ok) {
                  setEpickMsg(data?.error || "No se pudo crear el envío.");
                  return;
                }
                setEpick(data.shipment);
                setEpickMsg(data.reused ? "✅ Envío existente cargado." : "✅ Envío creado.");
                if (data.shipment?.mpUrl) {
                  window.open(data.shipment.mpUrl, "_blank");
                }
              }}
              className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60"
            >
              {shipLoading ? "Creando..." : epick ? "Recrear/Refrescar envío" : "Crear envío"}
            </button>

            <button
              disabled={!epick || epick?.status !== "PAYED"}
              onClick={async () => {
                setEpickMsg(null);
                const res = await fetch(`/api/shipping/confirm/${order.id}`, { method: "GET" });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setEpickMsg(data?.error || "No se pudo confirmar.");
                  return;
                }
                setEpick(data.shipment);
                setEpickMsg("✅ Envío confirmado.");
              }}
              className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
            >
              Confirmar retiro
            </button>

            <button
              disabled={!epick}
              onClick={async () => {
                setEpickMsg(null);
                const res = await fetch(`/api/shipping/tracking/${order.id}`, { method: "GET" });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  setEpickMsg(data?.error || "No se pudo consultar tracking.");
                  return;
                }
                setEpick((prev) => ({ ...(prev ?? {}), status: data.status }));
                setEpickMsg(`Tracking actualizado: ${data.status}`);
              }}
              className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60 disabled:opacity-50"
            >
              Consultar tracking
            </button>

            <a
              href={`/api/shipping/label/${order.id}?type=normal`}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60"
            >
              Etiqueta A4
            </a>

            <a
              href={`/api/shipping/label/${order.id}?type=thermal`}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60"
            >
              Etiqueta 10x15
            </a>
          </div>
        </div>
        )}
      </div>

      {printOrderOpen ? (
        <PrintOrderModal
          orderNumber={order.orderNumber}
          createdAt={order.createdAt}
          rows={billingRows}
          notes={merchantNotes.trim() || "—"}
          items={order.items.map((item) => ({
            id: item.id,
            name: item.nameSnapshot,
            quantity: item.quantity,
          }))}
          onClose={() => setPrintOrderOpen(false)}
        />
      ) : null}

      <style>{`
        @media print {
          html,
          body {
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            height: auto !important;
          }
          body * {
            visibility: hidden !important;
          }
          .billing-print-root,
          .billing-print-root * {
            visibility: visible !important;
          }
          .billing-print-root {
            display: block !important;
            position: fixed !important;
            inset: 0 !important;
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #111827 !important;
            border: 0 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .billing-print-root section,
          .billing-print-root div {
            break-inside: avoid;
          }
          .billing-screen-field {
            display: none !important;
          }
          .billing-print-value {
            display: block !important;
          }
          @page {
            margin: 14mm;
          }
        }
      `}</style>
    </main>
  );
}

function PrintOrderModal({
  orderNumber,
  createdAt,
  rows,
  notes,
  items,
  onClose,
}: {
  orderNumber: number;
  createdAt: string | Date;
  rows: string[][];
  notes: string;
  items: Array<{ id: string; name: string; quantity: number }>;
  onClose: () => void;
}) {
  const [draftRows, setDraftRows] = useState(rows);
  const editableBillingLabels = new Set(["Dirección", "Piso/Depto", "Código postal", "Localidad", "Provincia", "País"]);

  function updateDraftRow(index: number, value: string) {
    setDraftRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? [row[0], value] : row))
    );
  }

  function escapePrintText(value: string | number) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function printDraftOrder() {
    const rowsHtml = draftRows
      .map(
        ([label, value]) => `
          <div class="info-row">
            <div class="info-label">${escapePrintText(label)}</div>
            <div class="info-value">${escapePrintText(value || "—")}</div>
          </div>
        `
      )
      .join("");
    const itemsHtml = items
      .map(
        (item) => `
          <div class="item-row">
            <div>${escapePrintText(item.name)}</div>
            <div class="qty">${escapePrintText(item.quantity)}</div>
          </div>
        `
      )
      .join("");
    const notesHtml = escapePrintText(notes || "—").replace(/\n/g, "<br>");
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);

    const printWindow = iframe.contentWindow;
    const printDocument = printWindow?.document;
    if (!printWindow || !printDocument) {
      iframe.remove();
      return;
    }

    printDocument.open();
    printDocument.write(`<!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Pedido #${escapePrintText(orderNumber)}</title>
          <style>
            @page { margin: 14mm; }
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #fff;
              color: #8a4f1f;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
            }
            .sheet {
              width: 100%;
              max-width: 760px;
              margin: 0 auto;
              padding: 0;
            }
            .eyebrow {
              font-size: 11px;
              font-weight: 700;
              letter-spacing: .14em;
              color: #b1845f;
              text-transform: uppercase;
            }
            h1 {
              margin: 10px 0 4px;
              font-size: 24px;
              line-height: 1.15;
              color: #8a4f1f;
            }
            .date {
              color: #9a6028;
              font-size: 13px;
            }
            .rule {
              margin: 20px 0 24px;
              border-top: 1px solid #e3cdbb;
            }
            h2 {
              margin: 0 0 14px;
              font-size: 13px;
              letter-spacing: .1em;
              text-transform: uppercase;
              color: #b1845f;
            }
            .block {
              margin-top: 24px;
              break-inside: avoid;
            }
            .table {
              overflow: hidden;
              border: 1px solid #e3cdbb;
              border-radius: 10px;
            }
            .info-row {
              display: grid;
              grid-template-columns: 170px 1fr;
              border-bottom: 1px solid #e3cdbb;
            }
            .info-row:last-child,
            .item-row:last-child {
              border-bottom: 0;
            }
            .info-label {
              padding: 11px 14px;
              background: #faf7f4;
              color: #8a4f1f;
            }
            .info-value {
              padding: 11px 14px;
              color: #8a4f1f;
            }
            .item-head,
            .item-row {
              display: grid;
              grid-template-columns: 1fr 90px;
            }
            .item-head {
              background: #faf7f4;
              font-weight: 600;
              color: #8a4f1f;
            }
            .item-head div,
            .item-row div {
              padding: 11px 14px;
            }
            .item-row {
              border-top: 1px solid #e3cdbb;
              color: #8a4f1f;
            }
            .qty {
              text-align: right;
            }
            .notes {
              min-height: 72px;
              border: 1px solid #e3cdbb;
              border-radius: 10px;
              padding: 14px;
              color: #8a4f1f;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <main class="sheet">
            <div class="eyebrow">Orden de facturación</div>
            <h1>Pedido #${escapePrintText(orderNumber)}</h1>
            <div class="date">${escapePrintText(new Date(createdAt).toLocaleString("es-AR"))}</div>
            <div class="rule"></div>

            <section class="block">
              <h2>Datos de facturación</h2>
              <div class="table">${rowsHtml}</div>
            </section>

            <section class="block">
              <h2>Productos</h2>
              <div class="table">
                <div class="item-head"><div>Producto</div><div class="qty">Cantidad</div></div>
                ${itemsHtml}
              </div>
            </section>

            <section class="block">
              <h2>Notas</h2>
              <div class="notes">${notesHtml}</div>
            </section>
          </main>
        </body>
      </html>`);
    printDocument.close();
    printWindow.onafterprint = () => iframe.remove();
    window.setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      window.setTimeout(() => iframe.remove(), 1000);
    }, 100);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-5 py-4">
          <div>
            <div className="text-lg font-semibold">Orden de facturación</div>
            <div className="mt-1 text-xs text-zinc-500">Pedido #{orderNumber}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">
          <PrintableBillingOrder
            orderNumber={orderNumber}
            createdAt={createdAt}
            rows={draftRows}
            notes={notes}
            items={items}
            editableLabels={editableBillingLabels}
            onRowChange={updateDraftRow}
          />
        </div>

        <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={printDraftOrder}
            className="inline-flex items-center gap-2 rounded-2xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white"
          >
            <Printer className="h-4 w-4" />
            Imprimir PDF
          </button>
        </div>
      </div>
    </div>
  );
}

function PrintableBillingOrder({
  orderNumber,
  createdAt,
  rows,
  notes,
  items,
  editableLabels,
  onRowChange,
}: {
  orderNumber: number;
  createdAt: string | Date;
  rows: string[][];
  notes: string;
  items: Array<{ id: string; name: string; quantity: number }>;
  editableLabels?: Set<string>;
  onRowChange?: (index: number, value: string) => void;
}) {
  return (
    <section className="billing-print-root rounded-xl border border-zinc-800 bg-white p-6 text-zinc-950">
      <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Orden de facturación</div>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">Pedido #{orderNumber}</h2>
          <div className="mt-1 text-sm text-zinc-600">{new Date(createdAt).toLocaleString("es-AR")}</div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-500">Datos de facturación</h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          {rows.map(([label, value], index) => (
            <div key={label} className="grid grid-cols-[150px_1fr] border-b border-zinc-200 last:border-b-0">
              <div className="bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">{label}</div>
              <div className="px-4 py-3 text-sm text-zinc-950">
                {onRowChange && editableLabels?.has(label) ? (
                  <>
                    <input
                      value={value}
                      onChange={(event) => onRowChange(index, event.target.value)}
                      className="billing-screen-field w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-950 outline-none focus:border-[#9a6028]"
                    />
                    <span className="billing-print-value hidden">{value || "—"}</span>
                  </>
                ) : (
                  value
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-500">Productos</h3>
        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200">
          <div className="grid grid-cols-[1fr_90px] bg-zinc-50 px-4 py-3 text-sm font-medium text-zinc-600">
            <div>Producto</div>
            <div className="text-right">Cantidad</div>
          </div>
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-[1fr_90px] border-t border-zinc-200 px-4 py-3 text-sm text-zinc-950">
              <div>{item.name}</div>
              <div className="text-right">{item.quantity}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-zinc-500">Notas</h3>
        <div className="mt-4 min-h-24 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-950">
          {notes}
        </div>
      </div>
    </section>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="min-h-[300px] rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
      <div className="flex items-center gap-4">
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-200">
          {icon}
        </span>
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function InfoLine({ icon, value, muted = false, href, external = false }: { icon: ReactNode; value: string; muted?: boolean; href?: string; external?: boolean }) {
  const className = `mb-4 flex items-start gap-3 text-sm leading-5 ${muted ? "text-zinc-500" : "text-zinc-200"}`;
  const content = (
    <>
      <span className="mt-0.5 shrink-0 text-zinc-400">{icon}</span>
      <span className="break-words">{value}</span>
    </>
  );

  if (href) {
    return (
      <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className={`${className} transition hover:text-zinc-100`}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}

function Badge({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-200">
      {label}
    </span>
  );
}

type ActionCardTone = "success" | "sand" | "warning" | "danger" | "neutral";

function actionCardToneClasses(tone: ActionCardTone) {
  const map: Record<ActionCardTone, string> = {
    success: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    sand: "border-stone-300 bg-stone-100/90 text-stone-800",
    warning: "border-amber-200 bg-amber-50/80 text-amber-800",
    danger: "border-red-300 bg-red-50/80 text-red-700",
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };
  return map[tone];
}

function actionCardIconToneClasses(tone: ActionCardTone) {
  const map: Record<ActionCardTone, string> = {
    success: "bg-emerald-100 text-emerald-700",
    sand: "bg-stone-200 text-stone-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-600",
    neutral: "bg-zinc-200 text-zinc-600",
  };
  return map[tone];
}

function ActionCardButton({
  title,
  description,
  icon,
  tone,
  disabled,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  tone: ActionCardTone;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-24 w-full flex-col items-center justify-start rounded-2xl border px-3 py-2.5 text-center transition duration-150 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${actionCardToneClasses(tone)}`}
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${actionCardIconToneClasses(tone)}`}>
        {icon}
      </span>
      <span className="mt-2.5 text-sm font-semibold">{title}</span>
      <span className="mt-1.5 text-xs leading-4 text-current/70">{description}</span>
    </button>
  );
}

function ActionCardLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-24 w-full flex-col items-center justify-start rounded-2xl border px-3 py-2.5 text-center transition duration-150 hover:-translate-y-0.5 ${actionCardToneClasses("neutral")}`}
    >
      <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${actionCardIconToneClasses("neutral")}`}>
        {icon}
      </span>
      <span className="mt-2.5 text-sm font-semibold">{title}</span>
      <span className="mt-1.5 text-xs leading-4 text-current/70">{description}</span>
    </Link>
  );
}
