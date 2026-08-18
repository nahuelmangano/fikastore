import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import RegretButtonModal from "@/components/RegretButtonModal";

const PAYMENT_LOGOS = [
  { label: "Mercado Pago", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/mercadopago.png" },
  { label: "GOcuotas", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/5.png" },
  { label: "Mastercard", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/mastercard.png" },
  { label: "Visa", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/visa.png" },
  { label: "American Express", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/american-express.png" },
  { label: "Naranja", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/naranja.png" },
  { label: "Cabal", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/cabal.png" },
  { label: "Maestro", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/maestro.png" },
  { label: "Diners Club", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/diners-club.png" },
  { label: "Nativa", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/nativa.png" },
  { label: "Argencard", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/argencard.png" },
  { label: "Pago Fácil", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/pagofacil.png" },
  { label: "Rapipago", url: "https://dk0k1i3js6c49.cloudfront.net/applications/logos/payment-icons/rapipago.png" },
];

const SHIPPING_LOGOS = [
  { label: "E-pick", url: "https://dk0k1i3js6c49.cloudfront.net/iconos-envio/e-pick.png" },
  { label: "Correo Argentino", url: "https://dk0k1i3js6c49.cloudfront.net/iconos-envio/correo-argentino.png" },
  { label: "Envío personalizado", url: "https://dk0k1i3js6c49.cloudfront.net/iconos-envio/personalizado.png" },
  { label: "Acordar envío", url: "https://dk0k1i3js6c49.cloudfront.net/iconos-envio/acordar.png" },
];

export default async function StoreFooter() {
  const email = process.env.NEXT_PUBLIC_STORE_CONTACT_EMAIL || process.env.SUPPORT_EMAIL || "fika.arg@hotmail.com";
  const phone = process.env.NEXT_PUBLIC_STORE_CONTACT_PHONE || "1128460302";
  const location = process.env.NEXT_PUBLIC_STORE_CONTACT_LOCATION || "Buenos Aires, Argentina";

  return (
    <footer className="mt-20 border-t border-zinc-200 bg-white text-black">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-12 md:grid-cols-[1.2fr_1fr] lg:px-8">
        <div>
          <section>
            <h2 className="text-base font-normal uppercase">Medios de pago</h2>
            <div className="mt-3 flex max-w-xl flex-wrap gap-2">
              {PAYMENT_LOGOS.map((logo) => (
                <span key={logo.url} className="inline-flex h-7 w-12 items-center justify-center bg-zinc-50 px-1">
                  <Image src={logo.url} alt={logo.label} width={40} height={20} unoptimized className="max-h-5 w-auto object-contain" />
                </span>
              ))}
            </div>
          </section>

          <section className="mt-7">
            <h2 className="text-base font-normal uppercase">Medios de envío</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {SHIPPING_LOGOS.map((logo) => (
                <span key={logo.url} className="inline-flex h-8 w-16 items-center justify-center bg-zinc-50 px-1">
                  <Image src={logo.url} alt={logo.label} width={56} height={28} unoptimized className="max-h-7 w-auto object-contain" />
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-7">
          <section>
            <h2 className="text-base font-normal uppercase">Nuestras redes sociales</h2>
            <div className="mt-3 flex items-center gap-3">
              <a href="#" aria-label="Facebook" className="text-black hover:text-zinc-600"><FacebookIcon /></a>
              <a href="#" aria-label="Instagram" className="text-black hover:text-zinc-600"><InstagramIcon /></a>
              <a href="#" aria-label="TikTok" className="text-black hover:text-zinc-600"><TikTokIcon /></a>
            </div>
          </section>

          <section>
            <h2 className="text-base font-normal uppercase">Contacto</h2>
            <div className="mt-3 space-y-1.5 text-sm text-[var(--foreground)]">
              <a href={`mailto:${email}`} className="flex items-center gap-2 text-inherit hover:text-zinc-600"><Mail className="h-4 w-4" /> {email}</a>
              <a href={`tel:${phone}`} className="flex items-center gap-2 text-inherit hover:text-zinc-600"><Phone className="h-4 w-4" /> {phone}</a>
              <div className="flex items-center gap-2 text-inherit"><MapPin className="h-4 w-4" /> {location}</div>
              <RegretButtonModal />
            </div>
          </section>

          <section>
            <h2 className="text-base font-normal uppercase">Newsletter</h2>
            <form className="mt-3 flex max-w-sm" action="#">
              <input type="email" placeholder="Email" className="min-w-0 flex-1 border border-zinc-300 px-3 py-3 text-sm outline-none focus:border-black" />
              <button type="submit" className="bg-black px-6 py-3 text-sm font-medium uppercase text-white hover:bg-zinc-800">
                Suscribirme
              </button>
            </form>
          </section>
        </div>
      </div>

      <div className="border-t border-zinc-200">
        <div className="mx-auto max-w-7xl px-6 py-5 text-sm text-zinc-600 lg:px-8">
          Tienda creada por{" "}
          <a href="https://nmvdevelop.com.ar/" target="_blank" rel="noreferrer" className="font-semibold text-black hover:underline">
            NMV Develop
          </a>
        </div>
      </div>
    </footer>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path fill="currentColor" d="M14 8h2V5h-2.4C10.9 5 10 6.8 10 8.8V11H8v3h2v7h3v-7h2.5l.5-3h-3V9c0-.7.2-1 1-1Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path fill="currentColor" d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2Zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.3-2.5a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4Z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
      <path fill="currentColor" d="M15 3c.4 2.4 1.8 3.9 4 4.2V10a7.1 7.1 0 0 1-4-1.3V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .7 0 1 .1v3.1a2.5 2.5 0 1 0 1.5 2.3V3h3Z" />
    </svg>
  );
}
