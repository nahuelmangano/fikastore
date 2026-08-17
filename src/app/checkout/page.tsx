import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import CheckoutClient from "@/components/CheckoutClient";
import { getCheckoutPaymentSettings } from "@/lib/storeSettings";

export default async function CheckoutPage() {
  const [session, paymentSettings] = await Promise.all([
    getServerSession(authOptions),
    getCheckoutPaymentSettings(),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-2 text-zinc-400">
          Estás logueado como{" "}
          <span className="text-zinc-200">{session?.user?.email}</span>
        </p>

        <CheckoutClient paymentSettings={paymentSettings} />
      </div>
    </main>
  );
}
