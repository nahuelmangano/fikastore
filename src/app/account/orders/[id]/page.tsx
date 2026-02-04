import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import PayPendingButton from "@/components/PayPendingButton";
import CancelOrderButton from "@/components/CancelOrderButton";

function formatMoney(n: number) {
  return `$${n.toLocaleString("es-AR")}`;
}

export default async function OrderDetailPage({
  params,
}: {
  params: { id?: string } | Promise<{ id?: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams?.id?.trim();

  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) redirect(`/login?next=/account/orders/${id ?? ""}`);

  if (!id) return notFound();

  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: {
      items: true,
      payments: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!order) return notFound();

  const lastPayment = order.payments[0];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Link href="/account/orders" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Volver a mis pedidos
        </Link>

        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">Pedido #{order.orderNumber}</h1>
              <div className="mt-2 font-mono text-sm text-zinc-300">{order.id}</div>
              <div className="mt-2 text-xs text-zinc-500">
                {new Date(order.createdAt).toLocaleString("es-AR")}
              </div>
            </div>

            <div className="text-right">
              <Badge label={`Orden: ${order.status}`} />
              <div className="mt-2 text-sm text-zinc-300">
                Total: <span className="font-semibold">{formatMoney(Number(order.total))}</span>
              </div>
              <div className="mt-1 text-xs text-zinc-400">
                Pago: {lastPayment?.status ?? "—"}
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-6">
            <h2 className="text-base font-semibold">Envío</h2>
            <div className="mt-2 text-sm text-zinc-300">
              <div>{order.shippingName}</div>
              <div className="text-zinc-400">{order.shippingPhone}</div>
              <div className="mt-2">
                {order.shippingAddressLine}, {order.shippingCity} ({order.shippingZip})
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-zinc-800 pt-6">
            <h2 className="text-base font-semibold">Items</h2>
            <div className="mt-3 space-y-3">
              {order.items.map((it) => (
                <div
                  key={it.id}
                  className="flex items-start justify-between rounded-xl border border-zinc-800 bg-zinc-950/40 p-4"
                >
                  <div>
                    <div className="font-medium">{it.nameSnapshot}</div>
                    <div className="mt-1 text-sm text-zinc-400">
                      {it.quantity} × {formatMoney(Number(it.unitPrice))}
                    </div>
                  </div>
                  <div className="text-sm text-zinc-200">
                    {formatMoney(Number(it.subtotal))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-zinc-800 pt-4">
              <span className="text-zinc-300">Total</span>
              <span className="text-lg font-semibold">{formatMoney(Number(order.total))}</span>
            </div>
          </div>

          {/* Reintentar pago si está pendiente */}
          {order.status === "pending_payment" && (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="font-semibold">Pago pendiente</div>
              <p className="mt-2 text-sm text-zinc-400">
                Podés reintentar el pago sin recrear el carrito.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <PayPendingButton orderId={order.id} />
                <CancelOrderButton orderId={order.id} />
              </div>
            </div>
          )}
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
