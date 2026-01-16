import Link from "next/link";

type SuccessParamValue = string | string[] | undefined;

type SuccessParams = {
  orderId?: SuccessParamValue;
  order_id?: SuccessParamValue;
  external_reference?: SuccessParamValue;
  payment_id?: SuccessParamValue;
  merchant_order_id?: SuccessParamValue;
  preference_id?: SuccessParamValue;
};

export default function SuccessPage({ searchParams }: { searchParams: SuccessParams }) {
  const pick = (value: SuccessParamValue) => (Array.isArray(value) ? value[0] : value);
  const orderId =
    pick(searchParams.orderId) ||
    pick(searchParams.order_id) ||
    pick(searchParams.external_reference);
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Pago realizado ✅</h1>
        <p className="mt-2 text-zinc-400">
          Orden: <span className="font-mono text-zinc-200">{orderId ?? "-"}</span>
        </p>

        <p className="mt-6 text-zinc-300">
          Si el pedido todavía aparece “pendiente”, en unos segundos debería actualizarse cuando llegue el webhook.
        </p>

        <div className="mt-8 flex gap-3">
          <Link href="/" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
            Volver a la tienda
          </Link>
        </div>
      </div>
    </main>
  );
}
