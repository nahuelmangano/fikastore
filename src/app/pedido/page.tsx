import PayResultClient from "../pay/ui";
import PublicOrderLookupForm from "@/components/PublicOrderLookupForm";

type SearchParams =
  | { orderId?: string; email?: string }
  | Promise<{ orderId?: string; email?: string }>;

export default async function PedidoPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const orderId = String(resolvedSearchParams.orderId || "").trim();
  const email = String(resolvedSearchParams.email || "").trim().toLowerCase();

  if (orderId && email) {
    return (
      <PayResultClient
        title="Tu pedido"
        subtitle="Este es el estado actual de tu compra."
        orderId={orderId}
        accessEmail={email}
        hint="Si el pago o el envío cambian de estado, esta pantalla se actualiza automáticamente."
      />
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-8">
          <h1 className="text-2xl font-semibold">Consultar pedido</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Ingresá tu número de pedido y el email usado en la compra.
          </p>
          <PublicOrderLookupForm />
        </div>
      </div>
    </main>
  );
}
