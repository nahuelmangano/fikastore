"use client";

import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    MP_DEVICE_SESSION_ID?: string;
    MercadoPago?: new (publicKey: string, options?: { locale?: string }) => {
      bricks: () => {
        create: (
          brick: "cardPayment",
          target: string,
          settings: Record<string, unknown>,
        ) => Promise<{ unmount: () => void }>;
      };
    };
  }
}

type CardPaymentResponse = {
  ok?: boolean;
  status?: string;
  statusDetail?: string | null;
  paymentId?: string | null;
  error?: string;
  message?: string;
};

type BrickFormData = {
  token?: string;
  payment_method_id?: string;
  payment_type_id?: string;
  issuer_id?: string | number;
  installments?: number;
  payer?: {
    email?: string;
    identification?: {
      type?: string;
      number?: string;
    };
  };
  transaction_amount?: number | string;
};

type BrickAdditionalData = {
  bin?: string;
  lastFourDigits?: string;
  cardholderName?: string;
  paymentTypeId?: string;
};

const MP_SDK_SRC = "https://sdk.mercadopago.com/js/v2";

function loadMercadoPagoSdk() {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") return reject(new Error("SDK no disponible."));
    if (window.MercadoPago) return resolve();

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${MP_SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar Mercado Pago.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = MP_SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Mercado Pago."));
    document.body.appendChild(script);
  });
}

function rejectedMessage(statusDetail?: string | null) {
  const detail = String(statusDetail || "");
  if (detail.includes("cc_rejected_insufficient_amount")) return "La tarjeta no tiene fondos suficientes.";
  if (detail.includes("cc_rejected_bad_filled")) return "Revisá los datos de la tarjeta e intentá nuevamente.";
  if (detail.includes("cc_rejected_call_for_authorize")) return "La tarjeta requiere autorización del banco.";
  if (detail.includes("cc_rejected_high_risk")) return "Mercado Pago rechazó la operación por seguridad.";
  return "El pago fue rechazado. Podés intentar nuevamente con otra tarjeta.";
}

export default function MercadoPagoCardPayment({
  orderId,
  orderNumber,
  amount,
  publicKey,
  debug,
  payer,
  accessEmail,
  epickError,
  onCreateOrder,
  onPaymentComplete,
  embedded = false,
}: {
  orderId?: string;
  orderNumber: number | null;
  amount: number;
  publicKey: string;
  debug: boolean;
  payer: {
    email: string;
    identificationType: string;
    identificationNumber: string;
  };
  accessEmail?: string;
  epickError?: string | null;
  onCreateOrder?: () => Promise<{ orderId: string; orderNumber: number | null } | null>;
  onPaymentComplete?: () => void;
  embedded?: boolean;
}) {
  const containerId = useMemo(() => `mp-card-payment-${orderId || "checkout"}`, [orderId]);
  const controllerRef = useRef<{ unmount: () => void } | null>(null);
  const createdOrderRef = useRef<{ orderId: string; orderNumber: number | null } | null>(null);
  const mountedRef = useRef(false);
  const processingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "processing" | "approved" | "pending" | "rejected" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mountBrick() {
      if (!publicKey) {
        setStatus("error");
        setMessage("Falta configurar la Public Key de Mercado Pago.");
        return;
      }

      try {
        await loadMercadoPagoSdk();
        if (cancelled || mountedRef.current || !window.MercadoPago) return;

        const mp = new window.MercadoPago(publicKey, { locale: "es-AR" });
        const bricksBuilder = mp.bricks();
        controllerRef.current = await bricksBuilder.create("cardPayment", containerId, {
          initialization: {
            amount,
            payer: {
              email: payer.email,
              identification: {
                type: payer.identificationType,
                number: payer.identificationNumber,
              },
            },
          },
          customization: {
            visual: {
              hideFormTitle: true,
              style: { theme: "default" },
            },
            paymentMethods: {
              maxInstallments: 12,
            },
          },
          callbacks: {
            onReady: () => {
              setReady(true);
              setStatus("ready");
              setMessage(null);
            },
            onSubmit: async (formData: BrickFormData, additionalData?: BrickAdditionalData) => {
              if (processingRef.current) return Promise.reject();
              processingRef.current = true;
              setStatus("processing");
              setMessage("Procesando tu pago...");

              const deviceId = window.MP_DEVICE_SESSION_ID;
              let paymentOrderId = orderId || createdOrderRef.current?.orderId || null;
              if (!paymentOrderId && onCreateOrder) {
                setMessage("Creando tu pedido...");
                const createdOrder = await onCreateOrder();
                if (!createdOrder?.orderId) {
                  setStatus("error");
                  setMessage("No se pudo crear el pedido. Revisá los datos de envío e intentá nuevamente.");
                  processingRef.current = false;
                  return Promise.reject();
                }
                createdOrderRef.current = createdOrder;
                paymentOrderId = createdOrder.orderId;
              }

              if (!paymentOrderId) {
                setStatus("error");
                setMessage("No se pudo identificar el pedido para procesar el pago.");
                processingRef.current = false;
                return Promise.reject();
              }

              if (debug) {
                console.info("MercadoPago Card Brick Debug", {
                  publicKeyPrefix: `${publicKey.slice(0, 8)}...`,
                  formFields: Object.keys(formData),
                  cardTokenPresent: Boolean(formData.token),
                  paymentMethodId: formData.payment_method_id || null,
                  paymentTypeId: additionalData?.paymentTypeId || formData.payment_type_id || null,
                  installments: formData.installments ?? null,
                  issuerPresent: formData.issuer_id !== undefined && formData.issuer_id !== null,
                  payerEmailPresent: Boolean(formData.payer?.email),
                  identificationPresent: Boolean(formData.payer?.identification?.number),
                  transactionAmount: formData.transaction_amount ?? null,
                  deviceIdPresent: Boolean(deviceId),
                  additionalDataFields: additionalData ? Object.keys(additionalData) : [],
                });
              }

              try {
                const res = await fetch("/api/payments/mercadopago/card", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    orderId: paymentOrderId,
                    ...formData,
                    payment_type_id: additionalData?.paymentTypeId || formData.payment_type_id,
                    device_id: deviceId,
                  }),
                });
                const data = (await res.json().catch(() => ({}))) as CardPaymentResponse;

                if (!res.ok || !data.ok) {
                  setStatus("error");
                  setMessage(data.error || "No se pudo procesar el pago.");
                  processingRef.current = false;
                  return Promise.reject();
                }

                if (data.status === "approved") {
                  setStatus("approved");
                  setMessage("Pago aprobado. Te llevamos al comprobante...");
                  onPaymentComplete?.();
                  window.location.href = `/pay/success?orderId=${encodeURIComponent(paymentOrderId)}${accessEmail ? `&email=${encodeURIComponent(accessEmail)}` : ""}`;
                  return Promise.resolve();
                }

                if (data.status === "pending") {
                  setStatus("pending");
                  setMessage("Estamos procesando tu pago.");
                  onPaymentComplete?.();
                  window.location.href = `/pay/pending?orderId=${encodeURIComponent(paymentOrderId)}${accessEmail ? `&email=${encodeURIComponent(accessEmail)}` : ""}`;
                  return Promise.resolve();
                }

                setStatus("rejected");
                setMessage(rejectedMessage(data.statusDetail));
                processingRef.current = false;
                return Promise.reject();
              } catch {
                setStatus("error");
                setMessage("No pudimos conectar con Mercado Pago. Intentá nuevamente.");
                processingRef.current = false;
                return Promise.reject();
              }
            },
            onError: () => {
              setStatus("error");
              setMessage("Mercado Pago no pudo inicializar el formulario.");
            },
          },
        });
        mountedRef.current = true;
      } catch (error) {
        if (cancelled) return;
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "No se pudo cargar Mercado Pago.");
      }
    }

    mountBrick();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      controllerRef.current?.unmount();
      controllerRef.current = null;
      processingRef.current = false;
    };
  }, [accessEmail, amount, containerId, debug, onCreateOrder, onPaymentComplete, orderId, payer.email, payer.identificationNumber, payer.identificationType, publicKey]);

  return (
    <div className={embedded ? "border-t border-zinc-800 bg-zinc-950/20 p-4" : "mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4"}>
      {!embedded ? (
        <>
          <div className="font-semibold text-zinc-100">Pedido creado OK</div>
          <div className="mt-2 text-sm text-zinc-300">
            Numero de pedido: <span className="font-mono">{orderNumber ?? orderId}</span>
          </div>
        </>
      ) : null}

      {epickError ? (
        <div className="mt-3 rounded-xl border border-red-300 bg-red-100 p-3 text-sm text-red-800">
          {epickError}
        </div>
      ) : null}

      <div className={embedded ? "rounded-xl border border-zinc-800 bg-white p-3" : "mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3"}>
        {!ready && status === "loading" ? <div className="text-sm text-zinc-400">Cargando pago con tarjeta...</div> : null}
        <div id={containerId} className={status === "processing" ? "pointer-events-none opacity-60" : ""} />
      </div>

      {message ? (
        <div
          className={[
            "mt-3 rounded-xl border p-3 text-sm",
            status === "approved"
              ? "border-emerald-900/40 bg-emerald-900/20 text-emerald-200"
              : status === "pending" || status === "processing"
                ? "border-amber-900/40 bg-amber-900/20 text-amber-200"
                : status === "rejected" || status === "error"
                  ? "border-red-300 bg-red-100 text-red-800"
                  : "border-zinc-800 bg-zinc-950 text-zinc-300",
          ].join(" ")}
        >
          {message}
        </div>
      ) : null}

      <p className="mt-3 text-xs text-zinc-500">
        Los datos de la tarjeta los procesa Mercado Pago. No guardamos número de tarjeta, vencimiento ni CVV.
      </p>
    </div>
  );
}
