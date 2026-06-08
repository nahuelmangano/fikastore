"use client";

import { useEffect, useRef, useState } from "react";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

function currentParam(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) || fallback;
}

export default function StoreSearch({ categories }: { categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="text-2xl leading-none text-black hover:text-zinc-600"
        aria-label="Buscar"
      >
        ⌕
      </button>

      {open && (
        <form
          action="/"
          className="absolute right-0 top-full z-50 mt-8 w-[min(92vw,720px)] border border-zinc-200 bg-white p-4 text-black shadow-xl"
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs uppercase text-zinc-500">Buscar</label>
              <input
                name="q"
                defaultValue={currentParam("q", "")}
                placeholder="Buscar productos..."
                className="mt-2 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs uppercase text-zinc-500">Categoria</label>
              <select
                name="category"
                defaultValue={currentParam("category", "all")}
                className="mt-2 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
              >
                <option value="all">Todas</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase text-zinc-500">Disponibilidad</label>
              <select
                name="availability"
                defaultValue={currentParam("availability", "available")}
                className="mt-2 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
              >
                <option value="available">Disponibles</option>
                <option value="all">Todos</option>
                <option value="oos">Sin stock</option>
              </select>
            </div>

            <div>
              <label className="text-xs uppercase text-zinc-500">Orden</label>
              <select
                name="sort"
                defaultValue={currentParam("sort", "newest")}
                className="mt-2 w-full border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-black"
              >
                <option value="newest">Nuevos</option>
                <option value="price_asc">Precio ↑</option>
                <option value="price_desc">Precio ↓</option>
                <option value="stock_desc">Mayor stock</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <a href="/" className="border border-zinc-300 px-4 py-2 text-sm uppercase hover:bg-zinc-50">
              Limpiar
            </a>
            <button type="submit" className="bg-black px-4 py-2 text-sm font-semibold uppercase text-white">
              Buscar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
