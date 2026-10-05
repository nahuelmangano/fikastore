import Link from "next/link";
import CartLink from "@/components/CartLink";
import MobileStoreNav from "@/components/MobileStoreNav";
import StoreSearch from "@/components/StoreSearch";
import { flattenCategories } from "@/lib/categories";
import { getActiveInformationSections } from "@/lib/informationSections";
import { prisma } from "@/lib/prisma";
import { getStoreLogoUrl } from "@/lib/storeSettings";

export default async function StoreNav() {
  const [logoUrl, categories, informationSections] = await Promise.all([
    getStoreLogoUrl(),
    prisma.category.findMany({
      orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, sortOrder: true, name: true, slug: true },
    }),
    getActiveInformationSections(),
  ]);
  const categoryOptions = flattenCategories(categories);
  const rootCategories = categories.filter((category) => !category.parentId);
  const childrenByParent = new Map<string, typeof categories>();

  for (const category of categories) {
    if (!category.parentId) continue;
    childrenByParent.set(category.parentId, [...(childrenByParent.get(category.parentId) ?? []), category]);
  }

  return (
    <nav className="relative z-40 border-t-[5px] border-t-black bg-white text-black">
      <div className="relative hidden h-[88px] w-full items-center justify-between px-5 md:flex lg:px-10">
        <div className="flex h-full items-center gap-6 lg:gap-8">
          <Link href="/" className="flex h-full items-center text-sm font-normal uppercase leading-none hover:text-zinc-600">
            Inicio
          </Link>

          <div className="group/products relative flex h-full items-center">
            <Link href="/products" className="flex h-full items-center gap-3 text-sm font-normal uppercase leading-none hover:text-zinc-600">
              Productos
              <span className="mt-0.5 h-2 w-2 rotate-45 border-b border-r border-black" />
            </Link>
            <div className="invisible absolute left-0 top-full z-40 w-64 border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition group-hover/products:visible group-hover/products:opacity-100">
              {rootCategories.length === 0 ? (
                <Link href="/products" className="block px-4 py-3 text-sm uppercase hover:bg-zinc-50">
                  Todos los productos
                </Link>
              ) : (
                <>
                  {rootCategories.map((category) => {
                    const children = childrenByParent.get(category.id) ?? [];

                    return (
                      <div key={category.id} className="group/category relative">
                        <Link
                          href={`/products?category=${category.slug}`}
                          className="flex items-center justify-between px-4 py-3 text-sm uppercase hover:bg-zinc-50"
                        >
                          <span>{category.name}</span>
                          {children.length > 0 && <span className="text-xl leading-none">›</span>}
                        </Link>

                        {children.length > 0 && (
                          <div className="invisible absolute left-full top-0 z-50 w-64 border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition group-hover/category:visible group-hover/category:opacity-100">
                            {children.map((child) => (
                              <Link
                                key={child.id}
                                href={`/products?category=${child.slug}`}
                                className="flex items-center justify-between px-4 py-3 text-sm uppercase hover:bg-zinc-50"
                              >
                                <span>{child.name}</span>
                                {(childrenByParent.get(child.id)?.length ?? 0) > 0 && <span className="text-xl leading-none">›</span>}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="hidden">
                    {categoryOptions.map((category) => (
                  <Link
                    key={category.id}
                    href={`/products?category=${category.slug}`}
                    className="flex items-center justify-between px-4 py-3 text-sm uppercase hover:bg-zinc-50"
                  >
                    <span className={category.depth > 0 ? "pl-4 text-xs text-zinc-600" : ""}>
                      {category.depth > 0 ? category.name : category.label}
                    </span>
                    <span className="text-xl leading-none">›</span>
                  </Link>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="group relative flex h-full items-center">
            <button type="button" className="flex h-full items-center gap-3 text-sm font-normal uppercase leading-none hover:text-zinc-600">
              Información
              <span className="mt-0.5 h-2 w-2 rotate-45 border-b border-r border-black" />
            </button>
            <div className="invisible absolute left-0 top-full z-40 w-60 border border-zinc-200 bg-white py-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100">
              {informationSections.map((section) => (
                <Link
                  key={section.id}
                  href={`/informacion/${section.slug}`}
                  className="block px-4 py-3 text-sm uppercase hover:bg-zinc-50"
                >
                  {section.title}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <Link href="/" className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Fika Pijamas" className="h-20 w-36 object-contain" />
        </Link>

        <div className="flex h-full items-center">
          <CartLink variant="store" searchSlot={<StoreSearch categories={categoryOptions} />} />
        </div>
      </div>

      <MobileStoreNav logoUrl={logoUrl} categoryOptions={categoryOptions} informationSections={informationSections} />
    </nav>
  );
}
