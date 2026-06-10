import Link from "next/link";
import { getHomeCategoryTiles } from "@/lib/storeSettings";

export default async function HomePage() {
  const homeTiles = await getHomeCategoryTiles();

  return (
    <main className="min-h-screen bg-white text-black">
      {homeTiles.length > 0 ? (
        <section className="px-4 py-4 sm:px-8">
          <div className="mx-auto grid max-w-[1720px] gap-4 lg:grid-cols-2">
            {homeTiles.map((tile) => (
              <Link
                key={tile.id}
                href={`/products?category=${tile.categorySlug}`}
                className="group relative block aspect-[1.45/1] min-h-72 overflow-hidden bg-zinc-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.imageUrl}
                  alt={tile.title}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-0 bg-black/45 transition group-hover:bg-black/35" />
                <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-3xl font-bold uppercase tracking-wide text-white">
                  {tile.title}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h1 className="text-2xl font-semibold uppercase tracking-wide">Fika</h1>
          <p className="mt-3 text-sm text-zinc-500">Todavia no hay categorias destacadas configuradas.</p>
        </section>
      )}
    </main>
  );
}
