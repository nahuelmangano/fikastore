import PayResultClient from "../ui";

export default function PayFailurePage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  const orderId = searchParams.orderId;
  if (!orderId) {
    return (
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8">
            <h1 className="text-2xl font-semibold">Pago rechazado ❌</h1>
            <p className="mt-2 text-sm text-zinc-400">Falta orderId en la URL.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PayResultClient
      title="Pago rechazado ❌"
      subtitle="No se pudo completar el pago. Podés intentar nuevamente desde el checkout."
      orderId={orderId}
      hint="Si el pedido estaba pendiente, el stock queda reservado. Podés reintentar el pago."
    />
  );
}
