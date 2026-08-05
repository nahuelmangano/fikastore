"use client";

import Link from "next/link";
import { useRef } from "react";
import CartLink from "@/components/CartLink";
import StoreSearch from "@/components/StoreSearch";

type CategoryOption = {
  id: string;
  depth: number;
  name: string;
  slug: string;
};

type InformationSection = {
  id: string;
  slug: string;
  title: string;
};

type MobileStoreNavProps = {
  logoUrl: string;
  categoryOptions: CategoryOption[];
  informationSections: InformationSection[];
};

export default function MobileStoreNav({ logoUrl, categoryOptions, informationSections }: MobileStoreNavProps) {
  const menuRef = useRef<HTMLDetailsElement | null>(null);

  function closeMenu() {
    if (menuRef.current) {
      menuRef.current.open = false;
    }
  }

  return (
    <div className="relative flex h-[74px] w-full items-center justify-between px-4 md:hidden">
      <details className="group static" ref={menuRef}>
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
            <Link href="/" onClick={closeMenu} className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
              Inicio
            </Link>
            <Link href="/products" onClick={closeMenu} className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
              Productos
            </Link>
            {categoryOptions.map((category) => (
              <Link
                key={category.id}
                href={`/products?category=${category.slug}`}
                onClick={closeMenu}
                className={[
                  "py-2 text-xs uppercase text-zinc-500 hover:bg-zinc-50",
                  category.depth > 0 ? "px-8" : "px-5",
                ].join(" ")}
              >
                {category.name}
              </Link>
            ))}
            {informationSections.map((section) => (
              <Link
                key={section.id}
                href={`/informacion/${section.slug}`}
                onClick={closeMenu}
                className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50"
              >
                {section.title}
              </Link>
            ))}
            <Link href="/login" onClick={closeMenu} className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
              Cuenta
            </Link>
            <Link href="/register" onClick={closeMenu} className="px-2 py-3 text-sm uppercase text-black hover:bg-zinc-50">
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
        <CartLink variant="store" compact searchSlot={<StoreSearch categories={categoryOptions} />} />
      </div>
    </div>
  );
}
