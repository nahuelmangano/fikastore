import Link from "next/link";
import HomeBannerCarousel from "@/components/HomeBannerCarousel";
import StoreTemporarilyClosed from "@/components/StoreTemporarilyClosed";
import { getHomeBannerSettings, getHomeCategoryTiles, getTemporaryShutdownSettings } from "@/lib/storeSettings";

export default async function HomePage() {
  const [homeBanner, homeTiles, temporaryShutdown] = await Promise.all([
    getHomeBannerSettings(),
    getHomeCategoryTiles(),
    getTemporaryShutdownSettings(),
  ]);

  if (temporaryShutdown.isShutdown) {
    return <StoreTemporarilyClosed message={temporaryShutdown.message} />;
  }

  const featuredTiles = homeTiles;
  const primaryTiles = featuredTiles.slice(0, 2);
  const secondaryTiles = featuredTiles.slice(2);

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-white text-black">
      {featuredTiles.length > 0 ? (
        <section className="w-full overflow-hidden px-4 py-4 sm:px-8">
          <div className="mx-auto grid w-full max-w-[1720px] gap-4">
            {primaryTiles.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {primaryTiles.map((tile) => (
                  <HomeCategoryTile key={tile.id} tile={tile} className="aspect-[4/3] md:aspect-[1.43/1]" />
                ))}
              </div>
            ) : null}

            <HomeBannerCarousel settings={homeBanner} />

            {secondaryTiles.length > 0 ? (
              <div
                className={[
                  "grid grid-cols-1 gap-4",
                  secondaryTiles.length === 1 ? "md:grid-cols-1" : "",
                  secondaryTiles.length === 2 ? "md:grid-cols-2" : "",
                  secondaryTiles.length >= 3 ? "md:grid-cols-3" : "",
                ].join(" ")}
              >
                {secondaryTiles.map((tile) => (
                  <HomeCategoryTile key={tile.id} tile={tile} className="aspect-[4/3] md:aspect-[1.18/1]" />
                ))}
              </div>
            ) : null}
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

function HomeCategoryTile({
  tile,
  className,
}: {
  tile: {
    id: string;
    categorySlug: string;
    imageUrl: string;
    title: string;
  };
  className: string;
}) {
  return (
    <Link
      href={`/products?category=${tile.categorySlug}`}
      className={["group relative block w-full min-w-0 max-w-full overflow-hidden bg-zinc-200", className].join(" ")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.imageUrl}
        alt={tile.title}
        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-black/45 transition group-hover:bg-black/35" />
      <div className="absolute inset-0 flex items-center justify-center px-5 text-center text-2xl font-bold uppercase tracking-wide text-white sm:text-3xl">
        {tile.title}
      </div>
    </Link>
  );
}
