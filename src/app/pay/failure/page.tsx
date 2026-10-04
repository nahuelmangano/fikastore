import PayResultClient from "../ui";
import { getScreenTextSettings } from "@/lib/storeSettings";

type SearchParams = { orderId?: string; email?: string } | Promise<{ orderId?: string; email?: string }>;

export default async function PayFailurePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const orderId = String(resolvedSearchParams.orderId || "").trim();
  const email = String(resolvedSearchParams.email || "").trim().toLowerCase();
  const screenTextSettings = await getScreenTextSettings();
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
      title={screenTextSettings.paymentFailureTitle}
      subtitle={screenTextSettings.paymentFailureSubtitle}
      orderId={orderId}
      accessEmail={email || undefined}
      hint={screenTextSettings.paymentFailureHint}
      backToStoreLabel={screenTextSettings.paymentFailureBackToStoreButton}
      viewOrderLabel={screenTextSettings.paymentFailureViewOrderButton}
    />
  );
}
