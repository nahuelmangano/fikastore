import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import CheckoutClient from "@/components/CheckoutClient";
import { getCheckoutPaymentSettings, getScreenTextSettings } from "@/lib/storeSettings";

export default async function CheckoutPage() {
  const [session, paymentSettings, screenTextSettings] = await Promise.all([
    getServerSession(authOptions),
    getCheckoutPaymentSettings(),
    getScreenTextSettings(),
  ]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-2 text-zinc-400">
          {session?.user?.email
            ? <>Estás logueado como <span className="text-zinc-200">{session.user.email}</span></>
            : "Podés comprar como invitado o iniciar sesión si ya tenés cuenta."}
        </p>

        <CheckoutClient paymentSettings={paymentSettings} screenTextSettings={screenTextSettings} />
      </div>
    </main>
  );
}
