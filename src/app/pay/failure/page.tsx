import Link from "next/link";

export default function FailurePage({ searchParams }: { searchParams: { orderId?: string } }) {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Pago rechazado ❌</h1>
        <p className="mt-2 text-zinc-400">
          Orden: <span className="font-mono text-zinc-200">{searchParams.orderId ?? "-"}</span>
        </p>

        <p className="mt-6 text-zinc-300">
          Podés intentar pagar de nuevo desde el checkout.
        </p>

        <div className="mt-8 flex gap-3">
          <Link href="/checkout" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
            Volver al checkout
          </Link>
          <Link href="/" className="rounded-xl border border-zinc-800 px-4 py-2 text-sm hover:bg-zinc-900/60">
            Tienda
          </Link>
        </div>
      </div>
    </main>
  );
}
