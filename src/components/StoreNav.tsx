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
    <nav className="relative z-40 border-b border-zinc-200 bg-white text-black">
      <div className="relative mx-auto flex h-24 max-w-7xl items-center justify-between px-4 sm:px-8">
        <div className="flex h-full items-stretch">
          <Link href="/" className="flex items-center px-4 text-sm font-medium uppercase hover:bg-zinc-50">
            Inicio
          </Link>

          <div className="group relative flex items-stretch">
            <Link href="/" className="flex items-center gap-2 bg-zinc-50 px-4 text-sm font-medium uppercase">
              Productos
              <span className="border-x-[5px] border-t-[6px] border-x-transparent border-t-black" />
            </Link>
            <div className="invisible absolute left-0 top-full z-40 w-64 border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {categories.length === 0 ? (
                <Link href="/" className="block px-4 py-3 text-sm uppercase hover:bg-zinc-50">
                  Todos los productos
                </Link>
              ) : (
                categories.map((category) => (
                  <Link
                    key={category.id}
                    href={`/?category=${category.slug}`}
                    className="flex items-center justify-between px-4 py-3 text-sm uppercase hover:bg-zinc-50"
                  >
                    {category.name}
                    <span className="text-xl leading-none">›</span>
                  </Link>
                ))
              )}
            </div>
          </div>

          <div className="group relative flex items-stretch">
            <button type="button" className="flex items-center gap-2 px-4 text-sm font-medium uppercase hover:bg-zinc-50">
              Información
              <span className="border-x-[5px] border-t-[6px] border-x-transparent border-t-black" />
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

        <div className="flex h-full items-center gap-5">
          <CartLink variant="store" searchSlot={<StoreSearch categories={categories} />} />
        </div>
      </div>
    </nav>
  );
}
