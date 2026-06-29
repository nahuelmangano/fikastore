"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sanitizeRichText } from "@/lib/richText";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
  label?: string;
};

type HomeCategoryTile = {
  id: string;
  categoryId: string;
  categorySlug: string;
  title: string;
  imageUrl: string;
};

type InformationSection = {
  id: string;
  title: string;
  slug: string;
  content: string;
  isActive: boolean;
};

type TemporaryShutdownSettings = {
  isShutdown: boolean;
  message: string;
};

type BrowserCryptoWithUuid = Crypto & {
  randomUUID?: () => string;
};

function createClientId() {
  const browserCrypto = globalThis.crypto as BrowserCryptoWithUuid | undefined;

  if (typeof browserCrypto?.randomUUID === "function") {
    return browserCrypto.randomUUID();
  }

  if (typeof browserCrypto?.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    browserCrypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function slugify(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function AdminSettingsPage({
  announcementText,
  logoUrl,
  homeCategoryTiles,
  siteTitle,
  faviconUrl,
  temporaryShutdown,
  informationSections,
  categories,
}: {
  announcementText: string;
  logoUrl: string;
  homeCategoryTiles: HomeCategoryTile[];
  siteTitle: string;
  faviconUrl: string;
  temporaryShutdown: TemporaryShutdownSettings;
  informationSections: InformationSection[];
  categories: CategoryOption[];
}) {
  const [text, setText] = useState(announcementText);
  const [logo, setLogo] = useState(logoUrl);
  const [title, setTitle] = useState(siteTitle);
  const [favicon, setFavicon] = useState(faviconUrl);
  const [shutdownEnabled, setShutdownEnabled] = useState(temporaryShutdown.isShutdown);
  const [shutdownMessage, setShutdownMessage] = useState(temporaryShutdown.message);
  const [tiles, setTiles] = useState<HomeCategoryTile[]>(homeCategoryTiles);
  const [sections, setSections] = useState<InformationSection[]>(informationSections);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [faviconLoading, setFaviconLoading] = useState(false);
  const [shutdownLoading, setShutdownLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [tilesLoading, setTilesLoading] = useState(false);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [browserMsg, setBrowserMsg] = useState<string | null>(null);
  const [shutdownMsg, setShutdownMsg] = useState<string | null>(null);
  const [tileMsg, setTileMsg] = useState<string | null>(null);
  const [sectionsMsg, setSectionsMsg] = useState<string | null>(null);
  const informationContentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!informationContentRef.current || !editingSectionId) return;
    const section = sections.find((item) => item.id === editingSectionId);
    informationContentRef.current.innerHTML = sanitizeRichText(section?.content);
    // The editor should load content only when opening/switching pages, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingSectionId]);

  async function saveBrowserTitle() {
    setBrowserMsg(null);
    setBrowserLoading(true);

    const res = await fetch("/api/admin/settings/browser", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteTitle: title }),
    });

    const data = await res.json().catch(() => ({}));
    setBrowserLoading(false);

    if (!res.ok) {
      setBrowserMsg(String(data?.error || "No se pudo guardar."));
      return;
    }

    setTitle(data.siteTitle);
    setBrowserMsg("Titulo de pestana guardado.");
  }

  async function uploadFavicon(file: File) {
    setBrowserMsg(null);
    setFaviconLoading(true);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/settings/favicon", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    setFaviconLoading(false);

    if (!res.ok) {
      setBrowserMsg(String(data?.error || "No se pudo subir el favicon."));
      return;
    }

    setFavicon(data.faviconUrl);
    setBrowserMsg("Favicon actualizado.");
  }

  async function saveTemporaryShutdown(nextEnabled = shutdownEnabled) {
    setShutdownMsg(null);
    setShutdownLoading(true);

    const res = await fetch("/api/admin/settings/temporary-shutdown", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        isShutdown: nextEnabled,
        message: shutdownMessage,
      }),
    });

    const data = await res.json().catch(() => ({}));
    setShutdownLoading(false);

    if (!res.ok) {
      setShutdownMsg(String(data?.error || "No se pudo guardar el estado de la tienda."));
      return;
    }

    setShutdownEnabled(data.isShutdown === true);
    setShutdownMessage(String(data.message || ""));
    setShutdownMsg(data.isShutdown ? "Tienda apagada temporalmente." : "Tienda encendida.");
  }

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
        id: createClientId(),
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

  function addSection() {
    setSectionsMsg(null);
    const title = "Nueva seccion";
    const id = createClientId();
    setSections((prev) => [
      ...prev,
      {
        id,
        title,
        slug: `${slugify(title)}-${prev.length + 1}`,
        content: "",
        isActive: true,
      },
    ]);
    setEditingSectionId(id);
  }

  function patchSection(id: string, patch: Partial<InformationSection>) {
    setSections((prev) => prev.map((section) => (section.id === id ? { ...section, ...patch } : section)));
  }

  function setAllSectionsActive(isActive: boolean) {
    setSections((prev) => prev.map((section) => ({ ...section, isActive })));
  }

  function moveSection(fromId: string, toId: string) {
    if (fromId === toId) return;

    setSections((prev) => {
      const fromIndex = prev.findIndex((section) => section.id === fromId);
      const toIndex = prev.findIndex((section) => section.id === toId);
      if (fromIndex < 0 || toIndex < 0) return prev;

      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function syncInformationContentFromEditor() {
    if (!editingSectionId) return;
    patchSection(editingSectionId, {
      content: sanitizeRichText(informationContentRef.current?.innerHTML ?? ""),
    });
  }

  function formatInformationContent(command: string, value?: string) {
    informationContentRef.current?.focus();
    document.execCommand(command, false, value);
    syncInformationContentFromEditor();
  }

  function addInformationLink() {
    const url = window.prompt("URL del enlace");
    if (!url?.trim()) return;
    formatInformationContent("createLink", url.trim());
  }

  async function uploadInformationImage(file: File) {
    setSectionsMsg(null);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/admin/uploads/image", {
      method: "POST",
      body: fd,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.url) {
      setSectionsMsg(String(data?.error || "Error subiendo imagen para la pagina."));
      return;
    }

    informationContentRef.current?.focus();
    document.execCommand("insertHTML", false, `<img src="${data.url}" alt="" loading="lazy"><br>`);
    syncInformationContentFromEditor();
  }

  async function saveSections() {
    setSectionsMsg(null);

    const missingTitle = sections.find((section) => !section.title.trim());
    if (missingTitle) {
      setSectionsMsg("Todas las secciones necesitan un titulo.");
      return;
    }

    setSectionsLoading(true);

    const res = await fetch("/api/admin/settings/information-sections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });

    const data = await res.json().catch(() => ({}));
    setSectionsLoading(false);

    if (!res.ok) {
      setSectionsMsg(String(data?.error || "No se pudieron guardar las secciones."));
      return;
    }

    setSections(data.sections || []);
    setSectionsMsg("Secciones de informacion guardadas.");
  }

  const editingSection = sections.find((section) => section.id === editingSectionId) ?? null;
  const sectionsEnabled = sections.some((section) => section.isActive);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Configuracion</h1>
            <p className="mt-1 text-sm text-zinc-400">Ajustes visibles de la tienda.</p>
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Apagar temporalmente</h2>
              <div className="mt-5 space-y-2 text-xs text-zinc-400">
                <p>&gt; Con esta funcion podras apagar tu tienda temporalmente. Es ideal para cuando no puedas administrarla, por ejemplo cuando estas de vacaciones.</p>
                <p>&gt; Cuando la apagues, podras definir un mensaje opcional que se va a visualizar en la tienda.</p>
                <p>&gt; Tene en cuenta que mientras la tienda se encuentre apagada no se podran visualizar los productos.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => saveTemporaryShutdown(!shutdownEnabled)}
              disabled={shutdownLoading}
              className={[
                "rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50",
                shutdownEnabled
                  ? "border border-zinc-700 text-zinc-100 hover:bg-zinc-800"
                  : "bg-zinc-100 text-zinc-900 hover:bg-white",
              ].join(" ")}
            >
              {shutdownLoading ? "Guardando..." : shutdownEnabled ? "Encender" : "Apagar"}
            </button>
          </div>

          <label className="mt-5 block text-sm text-zinc-300">Mensaje para mostrar en la tienda</label>
          <textarea
            value={shutdownMessage}
            onChange={(e) => setShutdownMessage(e.target.value)}
            rows={3}
            maxLength={500}
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => saveTemporaryShutdown()}
              disabled={shutdownLoading}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              Guardar mensaje
            </button>
            <div className="text-xs text-zinc-500">{shutdownMessage.length}/500 caracteres</div>
          </div>

          {shutdownMsg && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">{shutdownMsg}</div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
          <h2 className="text-base font-semibold">Pestana del navegador</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_220px]">
            <div>
              <label className="block text-sm text-zinc-300">Titulo de la pestana</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveBrowserTitle}
                  disabled={browserLoading}
                  className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
                >
                  {browserLoading ? "Guardando..." : "Guardar titulo"}
                </button>
                <div className="text-xs text-zinc-500">{title.length}/80 caracteres</div>
              </div>
            </div>

            <div>
              <div className="text-sm text-zinc-300">Favicon</div>
              <div className="mt-2 flex items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={favicon} alt="Favicon actual" className="max-h-full max-w-full object-contain" />
                </div>
                <label className="cursor-pointer rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white">
                  {faviconLoading ? "Subiendo..." : "Cambiar favicon"}
                  <input
                    type="file"
                    accept="image/*,.ico"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadFavicon(file);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {browserMsg && (
            <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">{browserMsg}</div>
          )}
        </section>

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

        <section className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 text-zinc-100">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">Paginas de contenido</h2>
              <div className="mt-5 space-y-2 text-xs text-zinc-400">
                <p>&gt; Las paginas de contenido se agregan al menu principal y sirven para agregar informacion relevante en tu tienda.</p>
                <p>&gt; Podes agregar la informacion de tus politicas de devoluciones, preguntas frecuentes, tabla de talles, etc.</p>
                <p>&gt; Podes definir si la pagina de informacion es con texto o un link externo.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAllSectionsActive(!sectionsEnabled)}
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 disabled:opacity-50"
            >
              {sectionsEnabled ? "Desactivar" : "Activar"}
            </button>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/40">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-5">
              <h3 className="text-xl font-semibold text-zinc-100">Mis paginas</h3>
              <button
                type="button"
                onClick={addSection}
                className="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white"
              >
                Agregar
              </button>
            </div>

            <div>
              {sections.map((section) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={(event) => {
                    setDraggingSectionId(section.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", section.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDragOverSectionId(section.id);
                  }}
                  onDragLeave={() => {
                    setDragOverSectionId((current) => (current === section.id ? null : current));
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const fromId = event.dataTransfer.getData("text/plain") || draggingSectionId;
                    if (fromId) moveSection(fromId, section.id);
                    setDraggingSectionId(null);
                    setDragOverSectionId(null);
                  }}
                  onDragEnd={() => {
                    setDraggingSectionId(null);
                    setDragOverSectionId(null);
                  }}
                  className={[
                    "grid cursor-move grid-cols-[32px_1fr_auto] items-center gap-3 border-b border-zinc-800 px-5 py-4 transition last:border-b-0",
                    section.isActive ? "bg-zinc-950/20" : "bg-zinc-900/40 opacity-60",
                    draggingSectionId === section.id ? "opacity-40" : "",
                    dragOverSectionId === section.id && draggingSectionId !== section.id ? "bg-zinc-800/80 ring-1 ring-zinc-500" : "",
                  ].join(" ")}
                >
                  <div className="flex justify-center text-lg leading-none text-zinc-500" title="Arrastrar para ordenar" aria-hidden="true">
                    &#8942;&#8942;
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm text-zinc-100">{section.title}</div>
                    <div className="mt-0.5 text-xs text-zinc-400">Pagina de contenido</div>
                  </div>

                  <div className="flex items-center gap-5 text-zinc-400">
                    <Link
                      href={`/informacion/${section.slug}`}
                      target="_blank"
                      title="Ver pagina"
                      className="hover:text-zinc-100"
                    >
                      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 3h7v7" />
                        <path d="M10 14 21 3" />
                        <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
                      </svg>
                    </Link>
                    <button
                      type="button"
                      onClick={() => setEditingSectionId(editingSectionId === section.id ? null : section.id)}
                      title="Editar pagina"
                      className="hover:text-zinc-100"
                    >
                      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSections((prev) => prev.filter((item) => item.id !== section.id));
                        if (editingSectionId === section.id) setEditingSectionId(null);
                      }}
                      title="Borrar pagina"
                      className="hover:text-red-300"
                    >
                      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 15H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}

              {sections.length === 0 && (
                <div className="px-5 py-6 text-sm text-zinc-400">No hay paginas de contenido configuradas.</div>
              )}
            </div>
          </div>

          {editingSection && (
            <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-zinc-100">Editar pagina</h3>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={editingSection.isActive}
                    onChange={(e) => patchSection(editingSection.id, { isActive: e.target.checked })}
                    className="h-4 w-4"
                  />
                  Visible en Informacion
                </label>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-zinc-400">Titulo</label>
                  <input
                    value={editingSection.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      patchSection(editingSection.id, {
                        title,
                        slug: editingSection.slug ? editingSection.slug : slugify(title),
                      });
                    }}
                    maxLength={100}
                    className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400">URL</label>
                  <div className="mt-2 flex rounded-xl border border-zinc-800 bg-zinc-950 text-sm focus-within:border-zinc-600">
                    <span className="shrink-0 px-3 py-2 text-zinc-500">/informacion/</span>
                    <input
                      value={editingSection.slug}
                      onChange={(e) => patchSection(editingSection.id, { slug: slugify(e.target.value) })}
                      className="min-w-0 flex-1 bg-transparent px-3 py-2 text-zinc-100 outline-none"
                    />
                  </div>
                </div>
              </div>

              <label className="mt-4 block text-xs text-zinc-400">Contenido</label>
              <div className="mt-2 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                <div className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => formatInformationContent("bold")}
                    className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm font-bold text-zinc-100 hover:bg-zinc-900/60"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => formatInformationContent("italic")}
                    className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm italic text-zinc-100 hover:bg-zinc-900/60"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    onClick={() => formatInformationContent("underline")}
                    className="h-8 min-w-8 rounded-lg border border-zinc-800 px-2 text-sm text-zinc-100 underline hover:bg-zinc-900/60"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    onClick={() => formatInformationContent("formatBlock", "h2")}
                    className="h-8 rounded-lg border border-zinc-800 px-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900/60"
                  >
                    Titulo
                  </button>
                  <button
                    type="button"
                    onClick={() => formatInformationContent("insertUnorderedList")}
                    className="h-8 rounded-lg border border-zinc-800 px-2 text-sm text-zinc-100 hover:bg-zinc-900/60"
                  >
                    Lista
                  </button>
                  <button
                    type="button"
                    onClick={addInformationLink}
                    className="h-8 rounded-lg border border-zinc-800 px-2 text-sm text-zinc-100 hover:bg-zinc-900/60"
                  >
                    Link
                  </button>
                  <label className="flex h-8 cursor-pointer items-center rounded-lg border border-zinc-800 px-2 text-sm text-zinc-100 hover:bg-zinc-900/60">
                    Imagen
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadInformationImage(file);
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                </div>
                <div
                  ref={informationContentRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncInformationContentFromEditor}
                  className="min-h-52 w-full px-3 py-2 text-sm leading-6 text-zinc-100 outline-none [&_a]:text-zinc-100 [&_a]:underline [&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2"
                />
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={saveSections}
              disabled={sectionsLoading}
              className="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {sectionsLoading ? "Guardando..." : "Guardar paginas"}
            </button>
            {sectionsMsg && <div className="text-sm text-zinc-300">{sectionsMsg}</div>}
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
                                {category.label ?? category.name}
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
                          className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
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
