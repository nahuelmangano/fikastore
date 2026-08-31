"use client";

import Link from "next/link";
import { Check, PackageCheck, Truck, Undo2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

function money(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

type PriceValue = number | string;

type OrderPayment = {
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
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddressLine?: string | null;
  shippingCity?: string | null;
  shippingProvince?: string | null;
  shippingZip?: string | null;
  shippingAmount?: PriceValue | null;
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

export default function AdminOrderDetail({ order }: { order: AdminOrder }) {
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

  const lastPayment = order.payments?.[0];
  const itemsSubtotal = order.items.reduce(
    (acc: number, it) => acc + Number(it.subtotal || 0),
    0
  );
  const shippingAmount = Number(order.shippingAmount || 0);

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

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
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
              <h1 className="text-xl font-semibold">Pedido #{order.orderNumber}</h1>
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

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="text-sm font-semibold">Cliente</div>
              <div className="mt-2 text-sm text-zinc-300">{order.user?.name ?? "—"}</div>
              <div className="mt-1 text-sm text-zinc-400">{order.user?.email ?? "—"}</div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="text-sm font-semibold">Envío</div>
              <div className="mt-2 text-sm text-zinc-300">{order.shippingName}</div>
              <div className="mt-1 text-sm text-zinc-400">{order.shippingPhone}</div>
              <div className="mt-2 text-sm text-zinc-300">
                {order.shippingAddressLine}, {order.shippingCity}, {order.shippingProvince} ({order.shippingZip})
              </div>
            </div>
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
                  <div>
                    <div className="font-medium">{it.nameSnapshot}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {it.quantity} × {money(Number(it.unitPrice))}
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
                <span>{shippingAmount > 0 ? money(shippingAmount) : "Gratis"}</span>
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
                setMsg("✅ Pedido marcado como enviado.");
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
                    Revisá el contenido, agregá una nota si hace falta y envialo manualmente.
                  </p>
                </div>
                {shipEmailPreview?.to ? (
                  <div className="text-right text-xs text-zinc-500">
                    Para: <span className="text-zinc-300">{shipEmailPreview.to}</span>
                  </div>
                ) : null}
              </div>

              <label className="mt-4 block text-sm text-zinc-300">
                Mensaje adicional
                <textarea
                  value={shipEmailMessage}
                  onChange={(event) => setShipEmailMessage(event.target.value)}
                  placeholder="Ej: Te compartimos el aviso de despacho. En breve vas a poder seguir el envío desde el detalle del pedido."
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
        </div>

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
      </div>
    </main>
  );
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
