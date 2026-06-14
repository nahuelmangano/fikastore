import Link from "next/link";
import CartLink from "@/components/CartLink";
import StoreSearch from "@/components/StoreSearch";
import { prisma } from "@/lib/prisma";
import { getStoreLogoUrl } from "@/lib/storeSettings";

export default async function StoreNav() {
  const [logoUrl, categories] = await Promise.all([
    getStoreLogoUrl(),
    prisma.category.findMany({
      where: { products: { some: { isActive: true } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return (
    <nav className="relative z-40 border-t-[5px] border-t-black bg-white text-black">
      <div className="relative hidden h-[88px] w-full items-center justify-between px-5 md:flex lg:px-10">
        <div className="flex h-full items-center gap-6 lg:gap-8">
          <Link href="/" className="flex h-full items-center text-sm font-normal uppercase leading-none hover:text-zinc-600">
            Inicio
          </Link>

          <div className="group relative flex h-full items-center">
            <Link href="/products" className="flex h-full items-center gap-3 text-sm font-normal uppercase leading-none hover:text-zinc-600">
              Productos
              <span className="mt-0.5 h-2 w-2 rotate-45 border-b border-r border-black" />
            </Link>
            <div className="invisible absolute left-0 top-full z-40 w-64 border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {categories.length === 0 ? (
                <Link href="/products" className="block px-4 py-3 text-sm uppercase hover:bg-zinc-50">
                  Todos los productos
                </Link>
              ) : (
                categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/products?category=${category.slug}`}
                    className="flex items-center justify-between px-4 py-3 text-sm uppercase hover:bg-zinc-50"
                  >
                    {category.name}
                    <span className="text-xl leading-none">›</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="group relative flex h-full items-center">
            <button type="button" className="flex h-full items-center gap-3 text-sm font-normal uppercase leading-none hover:text-zinc-600">
              Información
              <span className="mt-0.5 h-2 w-2 rotate-45 border-b border-r border-black" />
            </button>
            <div className="invisible absolute left-0 top-full z-40 w-60 border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              <Link href="/checkout" className="block px-4 py-3 text-sm uppercase hover:bg-zinc-50">
                Medios de pago
              </Link>
              <Link href="/cart" className="block px-4 py-3 text-sm uppercase hover:bg-zinc-50">
                Envíos
              </Link>
              <Link href="/account/orders" className="block px-4 py-3 text-sm uppercase hover:bg-zinc-50">
                Mis pedidos
              </Link>
            </div>
          </div>
        </div>

        <Link href="/" className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Fika Pijamas" className="h-20 w-36 object-contain" />
        </Link>

        <div className="flex h-full items-center">
          <CartLink variant="store" searchSlot={<StoreSearch categories={categories} />} />
        </div>
      </div>

      <div className="relative flex h-[74px] w-full items-center justify-between px-4 md:hidden">
        <details className="group static">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center text-black hover:text-zinc-600 [&::-webkit-details-marker]:hidden">
            <span className="sr-only">Abrir menu</span>
            <svg aria-hidden="true" className="h-6 w-6 group-open:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
            <svg aria-hidden="true" className="hidden h-6 w-6 group-open:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </summary>

          <div className="absolute left-0 right-0 top-full z-50 max-h-[calc(100vh-79px)] overflow-y-auto border-t border-zinc-200 bg-white px-4 py-4 shadow-lg">
            <div className="grid gap-1">
              <Link href="/" className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
                Inicio
              </Link>
              <Link href="/products" className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
                Productos
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${category.slug}`}
                  className="px-5 py-2 text-xs uppercase text-zinc-500 hover:bg-zinc-50"
                >
                  {category.name}
                </Link>
              ))}
              <Link href="/checkout" className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
                Medios de pago
              </Link>
              <Link href="/cart" className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
                Envios
              </Link>
              <Link href="/account/orders" className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
                Mis pedidos
              </Link>
              <Link href="/login" className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
                Cuenta
              </Link>
              <Link href="/register" className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
                Contacto
              </Link>
            </div>
          </div>
        </details>

        <Link href="/" className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Fika Pijamas" className="h-16 w-28 object-contain" />
        </Link>

        <div className="flex h-full items-center">
          <CartLink variant="store" compact searchSlot={<StoreSearch categories={categories} />} />
        </div>
      </div>
    </nav>
  );
}
