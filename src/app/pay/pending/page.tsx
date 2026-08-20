import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock3, Mail } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCheckoutPaymentSettings } from "@/lib/storeSettings";
import { transferInstructionsWithBankDetails } from "@/lib/manualPaymentInstructions";
import PayPendingButton from "@/components/PayPendingButton";

type SearchParams = { orderId?: string } | Promise<{ orderId?: string }>;

function money(value: unknown) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`;
}

function lines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function paymentLabel(provider: string, fallback?: string) {
  if (provider === "mercadopago") return "Mercado Pago";
  if (provider === "transfer") return "Transferencia";
  if (provider === "cash") return "Efectivo";
  if (provider === "agreement") return "Acordar con la tienda";
  return fallback || provider || "Pago manual";
}

function shippingLabel(order: {
  shippingMethod: string | null;
  shippingDeliveryType: string | null;
  shippingBranchName: string | null;
}) {
  if (order.shippingMethod === "epick") return "E-pick";
  if (order.shippingMethod === "andreani") return "Andreani";
  if (order.shippingMethod === "correo") return order.shippingDeliveryType === "S" ? "Correo Argentino - Sucursal" : "Correo Argentino - Domicilio";
  if (order.shippingMethod === "pickup") return "Retiro en comercio";
  return order.shippingMethod || "Acordar envío";
}

function shippingAddress(order: {
  shippingMethod: string | null;
  shippingDeliveryType: string | null;
  shippingBranchName: string | null;
  shippingAddressLine: string;
  shippingCity: string;
  shippingProvince: string;
  shippingZip: string;
}) {
  if (order.shippingMethod === "pickup") return "Retiro en comercio";
  if (order.shippingMethod === "correo" && order.shippingDeliveryType === "S") {
    return [
      order.shippingBranchName ? `Sucursal: ${order.shippingBranchName}` : "Sucursal Correo Argentino",
      order.shippingAddressLine,
      [order.shippingCity, order.shippingProvince].filter(Boolean).join(", "),
      order.shippingZip ? `CP${order.shippingZip}` : "",
    ].filter(Boolean).join("\n");
  }
  return [
    order.shippingAddressLine,
    [order.shippingCity, order.shippingProvince].filter(Boolean).join(", "),
    order.shippingZip ? `CP${order.shippingZip}` : "",
  ].filter(Boolean).join("\n");
}

export default async function PayPendingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const orderId = String(resolvedSearchParams.orderId || "").trim();

  if (!orderId) {
    return (
      <main className="min-h-screen bg-white text-[#7A451C]">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-[#E5D7C8] bg-white p-8">
            <h1 className="text-2xl font-semibold">Pago pendiente</h1>
            <p className="mt-2 text-sm text-[#A97D58]">Falta orderId en la URL.</p>
          </div>
        </div>
      </main>
    );
  }

  const [order, paymentSettings] = await Promise.all([
    prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { email: true, name: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
        items: {
          include: {
            product: {
              include: {
                images: { where: { visible: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], take: 1 },
              },
            },
          },
        },
      },
    }),
    getCheckoutPaymentSettings(),
  ]);

  if (!order) return notFound();

  const payment = order.payments[0] || null;
  const provider = payment?.provider || "mercadopago";
  const manualMethod = paymentSettings.manualMethods.find((method) => method.key === provider);
  const label = paymentLabel(provider, manualMethod?.label);
  const baseInstructions =
    provider === "mercadopago"
      ? "Podés completar el pago desde el botón de abajo."
      : manualMethod?.instructions || "La tienda te contactará para coordinar el pago.";
  const paymentInstructions = provider === "transfer" ? transferInstructionsWithBankDetails(baseInstructions, manualMethod?.bankDetails) : baseInstructions;
  const subtotal = order.items.reduce((acc, item) => acc + Number(item.subtotal), 0);
  const shippingAmount = Number(order.shippingAmount || 0);
  const discount = Math.max(0, subtotal + shippingAmount - Number(order.total));
  const isMercadoPago = provider === "mercadopago";

  return (
    <main className="min-h-screen bg-white text-[#7A451C]">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        {order.user?.email ? (
          <p className="mt-2 text-[#A97D58]">
            Pedido asociado a <span className="text-[#8B4D20]">{order.user.email}</span>
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-[#E6D4C3] bg-white p-6">
            <h2 className="text-lg font-semibold">Resumen</h2>
            <div className="mt-5 space-y-4">
              {order.items.map((item) => {
                const imageUrl = item.product.images[0]?.url || "";
                return (
                  <div key={item.id} className="flex items-start gap-3">
                    {imageUrl ? (
                      <Image src={imageUrl} alt="" width={54} height={54} unoptimized className="h-14 w-14 rounded-lg object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-lg bg-[#F4ECE4]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[#7A451C]">{item.nameSnapshot}</div>
                      <div className="mt-1 text-xs text-[#B08360]">{item.quantity} x {money(item.unitPrice)}</div>
                    </div>
                    <div className="shrink-0 text-sm font-medium">{money(item.subtotal)}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 space-y-3 border-t border-[#E6D4C3] pt-5 text-sm">
              <Row label="Subtotal" value={money(subtotal)} />
              {discount > 0 ? <Row label="Descuento" value={`-${money(discount)}`} /> : null}
              <Row label="Envío" value={shippingAmount > 0 ? money(shippingAmount) : "Gratis"} />
              <div className="flex items-center justify-between pt-2 text-base">
                <span>Total</span>
                <span className="text-xl font-bold">{money(order.total)}</span>
              </div>
            </div>

            <Link href="/" className="mt-7 inline-block text-sm text-[#B08360] hover:text-[#7A451C]">
              ← Volver a la tienda
            </Link>
          </section>

          <section className="rounded-2xl border border-[#E6D4C3] bg-white p-6">
            <h2 className="text-lg font-semibold">Datos de pago</h2>

            <div className="mt-5 rounded-2xl border border-amber-500 bg-amber-50 p-5 text-amber-950">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 text-amber-600">
                  <Clock3 className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <div className="text-lg font-semibold">{isMercadoPago ? "Pago pendiente." : "Un paso más."}</div>
                  <p className="mt-1 text-sm text-amber-900">Tu orden #{order.orderNumber} fue procesada.</p>
                  <p className="mt-4 text-sm">
                    {isMercadoPago
                      ? "Podés completar el pago desde Mercado Pago."
                      : "Utilizá los datos que figuran debajo para completar el pago."}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#E6D4C3] bg-white p-5">
              <h3 className="font-semibold">{provider === "transfer" ? "Datos para transferencia" : label}</h3>
              <div className="mt-4 space-y-1 text-sm leading-6 text-[#8B5A2B]">
                {lines(paymentInstructions).map((line) => (
                  <p key={line} className="m-0">{line}</p>
                ))}
              </div>
              {isMercadoPago ? (
                <div className="mt-5">
                  <PayPendingButton orderId={order.id} />
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-[#E6D4C3] bg-white p-5">
              <h3 className="font-semibold">Información de tu compra</h3>
              <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
                <InfoItem label="Método de envío" value={shippingLabel(order)} />
                <InfoItem label="Estado del envío" value="Pendiente" />
                <InfoItem label="Destinatario" value={`${order.shippingName}${order.shippingPhone ? `\nTel: ${order.shippingPhone}` : ""}`} />
                <InfoItem label="Método de pago" value={label} />
                <InfoItem label="Domicilio" value={shippingAddress(order)} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-xs text-[#B08360]">
              <Mail className="h-4 w-4" aria-hidden="true" />
              <span>Te enviamos un email con el detalle del pedido.</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[#A97D58]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-semibold text-[#8B4D20]">{label}</div>
      <div className="mt-2 whitespace-pre-wrap leading-6 text-[#B08360]">{value}</div>
    </div>
  );
}
