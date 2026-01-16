import Link from "next/link";

export default function PendingPage({ searchParams }: { searchParams: { orderId?: string } }) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Pago pendiente ⏳</h1>
        <p className="mt-2 text-zinc-400">
          Orden: <span className="font-mono text-zinc-200">{searchParams.orderId ?? "-"}</span>
        </p>

        <p className="mt-6 text-zinc-300">
          Si el pago se aprueba, la orden se actualizará automáticamente cuando llegue la notificación.
        </p>

        <div className="mt-8 flex gap-3">
          <Link href="/checkout" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
            Volver al checkout
          </Link>
        </div>
      </div>
    </main>
  );
}
