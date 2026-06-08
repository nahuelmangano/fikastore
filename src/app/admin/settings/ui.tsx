"use client";

import Link from "next/link";
import { useState } from "react";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
};

type HomeCategoryTile = {
  id: string;
  categoryId: string;
  categorySlug: string;
  title: string;
  imageUrl: string;
};

export default function AdminSettingsPage({
  announcementText,
  logoUrl,
  homeCategoryTiles,
  categories,
}: {
  announcementText: string;
  logoUrl: string;
  homeCategoryTiles: HomeCategoryTile[];
  categories: CategoryOption[];
}) {
  const [text, setText] = useState(announcementText);
  const [logo, setLogo] = useState(logoUrl);
  const [tiles, setTiles] = useState<HomeCategoryTile[]>(homeCategoryTiles);
  const [loading, setLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [tileMsg, setTileMsg] = useState<string | null>(null);

  async function save() {
    setMsg(null);
    setLoading(true);

    const res = await fetch("/api/admin/settings/announcement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo guardar."));
      return;
    }

    setText(data.text);
    setMsg("Texto guardado.");
  }

  async function uploadLogo(file: File) {
    setMsg(null);
    setLogoLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/settings/logo", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    setLogoLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo subir el logo."));
      return;
    }

    setLogo(data.logoUrl);
    setMsg("Logo actualizado.");
  }

  function addTile() {
    setTileMsg(null);
    const category = categories[0];
    if (!category) {
      setTileMsg("Primero crea una categoria.");
      return;
    }

    setTiles((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        categoryId: category.id,
        categorySlug: category.slug,
        title: category.name,
        imageUrl: "",
      },
    ]);
  }

  function patchTile(id: string, patch: Partial<HomeCategoryTile>) {
    setTiles((prev) => prev.map((tile) => (tile.id === id ? { ...tile, ...patch } : tile)));
  }

  async function uploadTileImage(id: string, file: File) {
    setTileMsg(null);
    setTilesLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/settings/home-categories/image", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    setTilesLoading(false);

    if (!res.ok) {
      setTileMsg(String(data?.error || "No se pudo subir la imagen."));
      return;
    }

    patchTile(id, { imageUrl: data.imageUrl });
    setTileMsg("Imagen cargada. Ahora guarda las categorias destacadas.");
  }

  async function saveTiles() {
    setTileMsg(null);

    const missingImage = tiles.find((tile) => !tile.imageUrl.trim());
    if (missingImage) {
      setTileMsg("Falta subir una imagen en una de las categorias destacadas.");
      return;
    }

    setTilesLoading(true);

    const res = await fetch("/api/admin/settings/home-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiles }),
    });

    const data = await res.json().catch(() => ({}));
    setTilesLoading(false);

    if (!res.ok) {
      setTileMsg(String(data?.error || "No se pudieron guardar las categorias destacadas."));
      return;
    }

    setTiles(data.tiles || []);
    setTileMsg("Categorias destacadas guardadas.");
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configuracion</h1>
            <p className="mt-1 text-sm text-zinc-400">Texto superior visible en la tienda.</p>
          </div>

          <Link
            href="/"
            target="_blank"
            className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
          >
            Ver tienda
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-base font-semibold">Barra promocional</h2>

          <label className="mt-5 block text-sm text-zinc-300">Texto</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={500}
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          />

          <div className="mt-3 rounded-xl bg-black px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-white sm:text-sm">
            {text.trim() || "Vista previa"}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
            <div className="text-xs text-zinc-500">{text.length}/500 caracteres</div>
          </div>

          {msg && <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">{msg}</div>}
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-base font-semibold">Logo del encabezado</h2>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <div className="flex h-28 w-48 items-center justify-center rounded-xl border border-zinc-800 bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="Logo actual" className="max-h-full max-w-full object-contain" />
            </div>

            <label className="cursor-pointer rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
              {logoLoading ? "Subiendo..." : "Cambiar imagen"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Categorias destacadas de la home</h2>
              <p className="mt-1 text-sm text-zinc-400">Tarjetas grandes que aparecen arriba del listado.</p>
            </div>
            <button
              type="button"
              onClick={addTile}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              + Agregar
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            {tiles.map((tile) => {
              const selectedCategory = categories.find((category) => category.id === tile.categoryId);
              return (
                <div key={tile.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
                  <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                      <div className="relative aspect-[4/3]">
                        {tile.imageUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={tile.imageUrl} alt={tile.title} className="h-full w-full object-cover opacity-70" />
                            <div className="absolute inset-0 flex items-center justify-center text-xl font-bold uppercase text-white">
                              {tile.title || selectedCategory?.name}
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-zinc-500">Sin imagen</div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="text-xs text-zinc-400">Categoria</label>
                          <select
                            value={tile.categoryId}
                            onChange={(e) => {
                              const category = categories.find((item) => item.id === e.target.value);
                              if (!category) return;
                              patchTile(tile.id, {
                                categoryId: category.id,
                                categorySlug: category.slug,
                                title: tile.title || category.name,
                              });
                            }}
                            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                          >
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs text-zinc-400">Titulo visible</label>
                          <input
                            value={tile.title}
                            onChange={(e) => patchTile(tile.id, { title: e.target.value })}
                            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
                          {tile.imageUrl ? "Cambiar imagen" : "Subir imagen"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) uploadTileImage(tile.id, file);
                              e.currentTarget.value = "";
                            }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => setTiles((prev) => prev.filter((item) => item.id !== tile.id))}
                          className="rounded-xl border border-red-900/40 bg-red-900/20 px-4 py-2 text-sm text-red-200 hover:bg-red-900/30"
                        >
                          Borrar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {tiles.length === 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-5 text-sm text-zinc-400">
                No hay categorias destacadas configuradas.
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={saveTiles}
            disabled={tilesLoading}
            className="mt-5 rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {tilesLoading ? "Guardando..." : "Guardar categorias destacadas"}
          </button>

          {tileMsg && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">{tileMsg}</div>
          )}
        </section>
      </div>
    </main>
  );
}
