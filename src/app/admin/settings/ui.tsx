"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  Eye,
  FileText,
  GripVertical,
  Home,
  ImageIcon,
  LayoutGrid,
  LinkIcon,
  Monitor,
  Paintbrush,
  Plus,
  Save,
  Settings,
  Store,
  Trash2,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";
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

type SettingsTab = "appearance" | "home" | "content" | "pages" | "categories";

const tabs: { key: SettingsTab; label: string; icon: LucideIcon }[] = [
  { key: "appearance", label: "Apariencia", icon: Paintbrush },
  { key: "home", label: "Inicio", icon: Home },
  { key: "content", label: "Contenido", icon: Monitor },
  { key: "pages", label: "Páginas", icon: FileText },
  { key: "categories", label: "Categorías", icon: LayoutGrid },
];

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
  const [activeTab, setActiveTab] = useState<SettingsTab>("appearance");
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
    <main className="min-h-screen bg-[#FAF8F5] text-[#70471F]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[#A37A55]">Centro de configuración</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#5F3B18]">Configuración</h1>
            <p className="mt-2 max-w-2xl text-base text-[#8F6A49]">
              Personalizá la apariencia y el contenido de tu tienda.
            </p>
          </div>
          <Link
            href="/"
            target="_blank"
            className="inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#70471F]"
          >
            Ver tienda
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </header>

        <div className="mt-8 xl:mt-6 flex gap-2 overflow-x-auto rounded-3xl border border-[#E5D7C8] bg-white/70 p-2 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 xl:py-2 text-sm font-semibold transition duration-150",
                  active ? "bg-[#8B5A2B] text-white shadow-sm" : "text-[#7B522E] hover:bg-[#F2ECE5]",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "appearance" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <SectionCard title="Apariencia" description="Personalizá la identidad visual de tu tienda." icon={Paintbrush}>
                <div className="grid gap-5 xl:gap-4 lg:grid-cols-2">
                  <UploadCard
                    title="Logo"
                    description="Se muestra en el encabezado de la tienda. Recomendado PNG o SVG."
                    imageUrl={logo}
                    emptyTitle="Todavía no cargaste un logo."
                    emptyDescription="Subí una imagen PNG o SVG."
                    loading={logoLoading}
                    buttonLabel={logo ? "Cambiar imagen" : "Subir logo"}
                    accept="image/*"
                    onUpload={uploadLogo}
                    large
                  />

                  <UploadCard
                    title="Favicon"
                    description="Icono de la pestaña del navegador."
                    imageUrl={favicon}
                    emptyTitle="Todavía no cargaste un favicon."
                    emptyDescription="Subí una imagen cuadrada o .ico."
                    loading={faviconLoading}
                    buttonLabel={favicon ? "Cambiar favicon" : "Subir favicon"}
                    accept="image/*,.ico"
                    onUpload={uploadFavicon}
                  />
                </div>

                <div className="mt-6 xl:mt-4 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                  <FieldLabel label="Título de la pestaña" help="Este texto aparece en el título del navegador." />
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={80}
                    className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <PrimaryButton onClick={saveBrowserTitle} loading={browserLoading} label="Guardar título" />
                    <span className="text-xs text-[#A37A55]">{title.length}/80 caracteres</span>
                  </div>
                  {browserMsg ? <Notice>{browserMsg}</Notice> : null}
                </div>
              </SectionCard>
            </div>

            <StorePreview logo={logo} text={text} title={title} shutdownEnabled={shutdownEnabled} />
          </div>
        ) : null}

        {activeTab === "home" ? (
          <div className="mt-8 xl:mt-6">
            <HomeTilesSection
              tiles={tiles}
              categories={categories}
              tilesLoading={tilesLoading}
              tileMsg={tileMsg}
              addTile={addTile}
              patchTile={patchTile}
              uploadTileImage={uploadTileImage}
              saveTiles={saveTiles}
              removeTile={(id) => setTiles((prev) => prev.filter((item) => item.id !== id))}
            />
          </div>
        ) : null}

        {activeTab === "content" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <SectionCard title="Contenido de inicio" description="Mensajes y estados visibles en la tienda." icon={Monitor}>
                <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                  <FieldLabel label="Banner superior" help="Utilizalo para promociones importantes o avisos de la tienda." />
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={4}
                    maxLength={500}
                    className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm leading-6 text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                  />
                  <div className="mt-3 rounded-2xl bg-[#8B5A2B] px-4 py-3 xl:py-2.5 text-center text-xs font-semibold uppercase tracking-wide text-white sm:text-sm">
                    {text.trim() || "Vista previa del mensaje superior"}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <PrimaryButton onClick={save} loading={loading} label="Guardar banner" />
                    <span className="text-xs text-[#A37A55]">{text.length}/500 caracteres</span>
                  </div>
                  {msg ? <Notice>{msg}</Notice> : null}
                </div>
              </SectionCard>

              <SectionCard title="Estado de la tienda" description="Apagá temporalmente la tienda cuando no puedas administrarla." icon={Store}>
                <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusBadge active={!shutdownEnabled} />
                      <span className="text-sm font-semibold text-[#5F3B18]">
                        {shutdownEnabled ? "Tienda apagada" : "Tienda activa"}
                      </span>
                    </div>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[#8F6A49]">
                      Mientras la tienda esté apagada no se podrán visualizar los productos. Podés definir un mensaje opcional para los visitantes.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => saveTemporaryShutdown(!shutdownEnabled)}
                    disabled={shutdownLoading}
                    className={[
                      "rounded-2xl px-5 py-3 xl:py-2.5 text-sm font-semibold transition duration-150 disabled:opacity-50",
                      shutdownEnabled
                        ? "bg-[#8B5A2B] text-white hover:bg-[#70471F]"
                        : "border border-[#E5D7C8] text-[#8B5A2B] hover:bg-[#F2ECE5]",
                    ].join(" ")}
                  >
                    {shutdownLoading ? "Guardando..." : shutdownEnabled ? "Encender tienda" : "Apagar tienda"}
                  </button>
                </div>

                <div className="mt-5">
                  <FieldLabel label="Mensaje para mostrar en la tienda" help="Este texto se muestra cuando la tienda está apagada temporalmente." />
                  <textarea
                    value={shutdownMessage}
                    onChange={(e) => setShutdownMessage(e.target.value)}
                    rows={3}
                    maxLength={500}
                    className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-3 xl:py-2.5 text-sm leading-6 text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <SecondaryButton onClick={() => saveTemporaryShutdown()} loading={shutdownLoading} label="Guardar mensaje" />
                    <span className="text-xs text-[#A37A55]">{shutdownMessage.length}/500 caracteres</span>
                  </div>
                  {shutdownMsg ? <Notice>{shutdownMsg}</Notice> : null}
                </div>
              </SectionCard>
            </div>

            <StorePreview logo={logo} text={text} title={title} shutdownEnabled={shutdownEnabled} />
          </div>
        ) : null}

        {activeTab === "pages" ? (
          <div className="mt-8 xl:mt-6">
            <PagesSection
              sections={sections}
              editingSection={editingSection}
              editingSectionId={editingSectionId}
              draggingSectionId={draggingSectionId}
              dragOverSectionId={dragOverSectionId}
              sectionsEnabled={sectionsEnabled}
              sectionsLoading={sectionsLoading}
              sectionsMsg={sectionsMsg}
              informationContentRef={informationContentRef}
              setDraggingSectionId={setDraggingSectionId}
              setDragOverSectionId={setDragOverSectionId}
              setEditingSectionId={setEditingSectionId}
              setSections={setSections}
              addSection={addSection}
              patchSection={patchSection}
              setAllSectionsActive={setAllSectionsActive}
              moveSection={moveSection}
              formatInformationContent={formatInformationContent}
              addInformationLink={addInformationLink}
              uploadInformationImage={uploadInformationImage}
              syncInformationContentFromEditor={syncInformationContentFromEditor}
              saveSections={saveSections}
            />
          </div>
        ) : null}

        {activeTab === "categories" ? (
          <div className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionCard title="Categorías" description="Referencia rápida de las categorías disponibles para destacar en el inicio." icon={LayoutGrid}>
              {categories.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {categories.map((category) => (
                    <div key={category.id} className="rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                      <div className="font-semibold text-[#5F3B18]">{category.label ?? category.name}</div>
                      <div className="mt-1 text-xs text-[#8F6A49]">/{category.slug}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={LayoutGrid} title="No hay categorías creadas." description="Creá categorías desde Catálogo para poder destacarlas en el inicio." />
              )}
            </SectionCard>

            <SectionCard title="Categorías destacadas" description="Esta configuración vive en la pestaña Inicio." icon={Home}>
              <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
                <div className="text-3xl font-semibold text-[#5F3B18]">{tiles.length}</div>
                <p className="mt-2 text-sm text-[#8F6A49]">Categorías destacadas configuradas para la home.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("home")}
                  className="mt-5 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]"
                >
                  Configurar inicio
                </button>
              </div>
            </SectionCard>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)]">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-2xl bg-[#F2ECE5] p-3 text-[#8B5A2B]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#5F3B18]">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[#8F6A49]">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ label, help }: { label: string; help?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#70471F]">{label}</span>
      {help ? <span className="mt-1 block text-sm text-[#8F6A49]">{help}</span> : null}
    </label>
  );
}

function PrimaryButton({ onClick, loading, label }: { onClick: () => void; loading?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-[#70471F] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Save className="h-4 w-4" aria-hidden="true" />
      {loading ? "Guardando..." : label}
    </button>
  );
}

function SecondaryButton({ onClick, loading, label }: { onClick: () => void; loading?: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-2xl border border-[#E5D7C8] px-4 py-2 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5] disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Guardando..." : label}
    </button>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#70471F]">
      {children}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
        active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800",
      ].join(" ")}
    >
      {active ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {active ? "Activa" : "Pausada"}
    </span>
  );
}

function UploadCard({
  title,
  description,
  imageUrl,
  emptyTitle,
  emptyDescription,
  loading,
  buttonLabel,
  accept,
  onUpload,
  large = false,
}: {
  title: string;
  description: string;
  imageUrl: string;
  emptyTitle: string;
  emptyDescription: string;
  loading: boolean;
  buttonLabel: string;
  accept: string;
  onUpload: (file: File) => void;
  large?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-[#5F3B18]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#8F6A49]">{description}</p>
        </div>
        <ImageIcon className="h-5 w-5 shrink-0 text-[#B18B68]" aria-hidden="true" />
      </div>

      <div
        className={[
          "mt-5 flex items-center justify-center overflow-hidden rounded-3xl border border-dashed border-[#D8C5B2] bg-white/70 p-4",
          large ? "h-44" : "h-32",
        ].join(" ")}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={title} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-center">
            <Upload className="mx-auto h-7 w-7 text-[#B18B68]" aria-hidden="true" />
            <div className="mt-3 text-sm font-semibold text-[#5F3B18]">{emptyTitle}</div>
            <div className="mt-1 text-sm text-[#8F6A49]">{emptyDescription}</div>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]">
          {loading ? "Subiendo..." : buttonLabel}
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
              e.currentTarget.value = "";
            }}
          />
        </label>
        {imageUrl ? <span className="text-xs text-[#A37A55]">Imagen configurada</span> : null}
      </div>
    </div>
  );
}

function StorePreview({
  logo,
  text,
  title,
  shutdownEnabled,
}: {
  logo: string;
  text: string;
  title: string;
  shutdownEnabled: boolean;
}) {
  return (
    <aside className="rounded-3xl border border-[#E5D7C8] bg-white/70 p-5 xl:p-4 shadow-[0_16px_40px_rgba(80,52,28,0.05)] xl:sticky xl:top-6 xl:self-start">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#5F3B18]">Preview en vivo</h2>
          <p className="mt-1 text-sm text-[#8F6A49]">Vista simplificada de la tienda.</p>
        </div>
        <Eye className="h-5 w-5 text-[#B18B68]" aria-hidden="true" />
      </div>

      <div className="overflow-hidden rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5]">
        <div className="bg-[#8B5A2B] px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-white">
          {text.trim() || "Mensaje superior"}
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-[#E5D7C8] bg-white px-5 py-4 xl:py-2.5">
          <div className="flex h-14 w-28 items-center justify-center rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] p-2">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs font-semibold text-[#B18B68]">Logo</span>
            )}
          </div>
          <div className="flex gap-2">
            <span className="h-8 w-16 rounded-full bg-[#F2ECE5]" />
            <span className="h-8 w-20 rounded-full bg-[#8B5A2B]" />
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-3xl bg-white p-5 xl:p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#B18B68]">Header</div>
            <div className="mt-2 text-xl font-semibold text-[#5F3B18]">{title || "Fika Store"}</div>
            <div className="mt-3 h-2 w-2/3 rounded-full bg-[#E5D7C8]" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-[#E5D7C8]" />
            <div className="mt-5 flex gap-3">
              <div className="h-10 flex-1 rounded-2xl bg-[#8B5A2B]" />
              <div className="h-10 flex-1 rounded-2xl border border-[#E5D7C8]" />
            </div>
          </div>
          {shutdownEnabled ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 xl:py-2.5 text-sm text-amber-900">
              La tienda está apagada temporalmente.
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

function HomeTilesSection({
  tiles,
  categories,
  tilesLoading,
  tileMsg,
  addTile,
  patchTile,
  uploadTileImage,
  saveTiles,
  removeTile,
}: {
  tiles: HomeCategoryTile[];
  categories: CategoryOption[];
  tilesLoading: boolean;
  tileMsg: string | null;
  addTile: () => void;
  patchTile: (id: string, patch: Partial<HomeCategoryTile>) => void;
  uploadTileImage: (id: string, file: File) => void;
  saveTiles: () => void;
  removeTile: (id: string) => void;
}) {
  return (
    <SectionCard title="Inicio" description="Configurá las categorías destacadas que aparecen en la home." icon={Home}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#5F3B18]">Categorías destacadas</h3>
          <p className="mt-1 text-sm text-[#8F6A49]">Cada tarjeta combina imagen, categoría y título visible.</p>
        </div>
        <button
          type="button"
          onClick={addTile}
          className="inline-flex items-center gap-2 rounded-2xl border border-[#E5D7C8] px-4 py-2 text-sm font-semibold text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Agregar
        </button>
      </div>

      {tiles.length === 0 ? (
        <EmptyState icon={Home} title="No hay categorías destacadas." description="Agregá una categoría para mostrarla como tarjeta principal en la home." />
      ) : (
        <div className="grid gap-5 xl:gap-4">
          {tiles.map((tile) => {
            const selectedCategory = categories.find((category) => category.id === tile.categoryId);
            return (
              <div key={tile.id} className="rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-4">
                <div className="grid gap-5 xl:gap-4 lg:grid-cols-[260px_1fr]">
                  <div className="overflow-hidden rounded-3xl border border-[#E5D7C8] bg-white">
                    <div className="relative aspect-[4/3]">
                      {tile.imageUrl ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={tile.imageUrl} alt={tile.title} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 px-4 text-center text-xl font-bold uppercase text-white">
                            {tile.title || selectedCategory?.name}
                          </div>
                        </>
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                          <ImageIcon className="h-7 w-7 text-[#B18B68]" aria-hidden="true" />
                          <div className="mt-3 text-sm font-semibold text-[#5F3B18]">Todavía no cargaste imagen.</div>
                          <div className="mt-1 text-sm text-[#8F6A49]">Subí una imagen para esta categoría.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid content-start gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <FieldLabel label="Categoría" help="Destino de la tarjeta destacada." />
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
                          className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                        >
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.label ?? category.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <FieldLabel label="Título visible" help="Texto que se muestra sobre la imagen." />
                        <input
                          value={tile.title}
                          onChange={(e) => patchTile(tile.id, { title: e.target.value })}
                          className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <label className="cursor-pointer rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]">
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
                        onClick={() => removeTile(tile.id)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition duration-150 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={saveTiles} loading={tilesLoading} label="Guardar categorías destacadas" />
        {tileMsg ? <span className="text-sm text-[#70471F]">{tileMsg}</span> : null}
      </div>
    </SectionCard>
  );
}

function PagesSection({
  sections,
  editingSection,
  editingSectionId,
  draggingSectionId,
  dragOverSectionId,
  sectionsEnabled,
  sectionsLoading,
  sectionsMsg,
  informationContentRef,
  setDraggingSectionId,
  setDragOverSectionId,
  setEditingSectionId,
  setSections,
  addSection,
  patchSection,
  setAllSectionsActive,
  moveSection,
  formatInformationContent,
  addInformationLink,
  uploadInformationImage,
  syncInformationContentFromEditor,
  saveSections,
}: {
  sections: InformationSection[];
  editingSection: InformationSection | null;
  editingSectionId: string | null;
  draggingSectionId: string | null;
  dragOverSectionId: string | null;
  sectionsEnabled: boolean;
  sectionsLoading: boolean;
  sectionsMsg: string | null;
  informationContentRef: React.RefObject<HTMLDivElement | null>;
  setDraggingSectionId: (id: string | null) => void;
  setDragOverSectionId: (id: string | null | ((current: string | null) => string | null)) => void;
  setEditingSectionId: (id: string | null) => void;
  setSections: React.Dispatch<React.SetStateAction<InformationSection[]>>;
  addSection: () => void;
  patchSection: (id: string, patch: Partial<InformationSection>) => void;
  setAllSectionsActive: (isActive: boolean) => void;
  moveSection: (fromId: string, toId: string) => void;
  formatInformationContent: (command: string, value?: string) => void;
  addInformationLink: () => void;
  uploadInformationImage: (file: File) => void;
  syncInformationContentFromEditor: () => void;
  saveSections: () => void;
}) {
  return (
    <SectionCard title="Páginas" description="Gestioná páginas de información visibles en el menú principal." icon={FileText}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StatusBadge active={sectionsEnabled} />
          <span className="text-sm text-[#8F6A49]">{sections.length} página{sections.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton onClick={() => setAllSectionsActive(!sectionsEnabled)} label={sectionsEnabled ? "Desactivar páginas" : "Activar páginas"} />
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#8B5A2B] px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[#70471F]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva página
          </button>
        </div>
      </div>

      {sections.length === 0 ? (
        <EmptyState icon={FileText} title="Todavía no existen páginas." description="Agregá páginas para políticas, preguntas frecuentes o tabla de talles." />
      ) : (
        <div className="grid gap-3">
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
                "grid cursor-move grid-cols-[32px_1fr_auto] items-center gap-3 rounded-2xl border border-[#E5D7C8] bg-[#FAF8F5] px-4 py-4 xl:py-2.5 transition duration-150",
                !section.isActive ? "opacity-60" : "",
                draggingSectionId === section.id ? "opacity-40" : "",
                dragOverSectionId === section.id && draggingSectionId !== section.id ? "ring-2 ring-[#8B5A2B]/30" : "",
              ].join(" ")}
            >
              <GripVertical className="h-5 w-5 text-[#B18B68]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="truncate font-semibold text-[#5F3B18]">{section.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#8F6A49]">
                  <span>/{section.slug}</span>
                  <span className={section.isActive ? "text-emerald-700" : "text-[#A37A55]"}>
                    {section.isActive ? "Activa" : "Inactiva"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/informacion/${section.slug}`}
                  target="_blank"
                  title="Ver página"
                  className="rounded-xl border border-[#E5D7C8] p-2 text-[#8B5A2B] hover:bg-[#F2ECE5]"
                >
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={() => setEditingSectionId(editingSectionId === section.id ? null : section.id)}
                  title="Editar página"
                  className="rounded-xl border border-[#E5D7C8] p-2 text-[#8B5A2B] hover:bg-[#F2ECE5]"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSections((prev) => prev.filter((item) => item.id !== section.id));
                    if (editingSectionId === section.id) setEditingSectionId(null);
                  }}
                  title="Eliminar página"
                  className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSection ? (
        <div className="mt-6 xl:mt-4 rounded-3xl border border-[#E5D7C8] bg-[#FAF8F5] p-5 xl:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#5F3B18]">Editar página</h3>
              <p className="mt-1 text-sm text-[#8F6A49]">Modificá título, URL y contenido.</p>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-[#70471F]">
              <input
                type="checkbox"
                checked={editingSection.isActive}
                onChange={(e) => patchSection(editingSection.id, { isActive: e.target.checked })}
                className="h-4 w-4 accent-[#8B5A2B]"
              />
              Visible
            </label>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <FieldLabel label="Nombre" help="Título visible para el cliente." />
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
                className="mt-2 w-full rounded-2xl border border-[#E5D7C8] bg-white/70 px-4 py-3 xl:py-2.5 text-sm text-[#5F3B18] outline-none focus:border-[#8B5A2B]"
              />
            </label>

            <label className="block">
              <FieldLabel label="URL" help="Ruta pública de la página." />
              <div className="mt-2 flex rounded-2xl border border-[#E5D7C8] bg-white/70 text-sm focus-within:border-[#8B5A2B]">
                <span className="shrink-0 px-4 py-3 xl:py-2.5 text-[#A37A55]">/informacion/</span>
                <input
                  value={editingSection.slug}
                  onChange={(e) => patchSection(editingSection.id, { slug: slugify(e.target.value) })}
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 xl:py-2.5 text-[#5F3B18] outline-none"
                />
              </div>
            </label>
          </div>

          <div className="mt-5">
            <FieldLabel label="Contenido" help="Texto enriquecido que verá el cliente." />
            <div className="mt-2 overflow-hidden rounded-2xl border border-[#E5D7C8] bg-white">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#E5D7C8] bg-[#FAF8F5] px-3 py-2">
                <ToolbarButton onClick={() => formatInformationContent("bold")} label="B" strong />
                <ToolbarButton onClick={() => formatInformationContent("italic")} label="I" italic />
                <ToolbarButton onClick={() => formatInformationContent("underline")} label="U" underline />
                <ToolbarButton onClick={() => formatInformationContent("formatBlock", "h2")} label="Título" />
                <ToolbarButton onClick={() => formatInformationContent("insertUnorderedList")} label="Lista" />
                <button
                  type="button"
                  onClick={addInformationLink}
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#E5D7C8] px-3 text-sm font-semibold text-[#70471F] hover:bg-[#F2ECE5]"
                >
                  <LinkIcon className="h-4 w-4" aria-hidden="true" />
                  Link
                </button>
                <label className="inline-flex h-9 cursor-pointer items-center gap-1 rounded-xl border border-[#E5D7C8] px-3 text-sm font-semibold text-[#70471F] hover:bg-[#F2ECE5]">
                  <ImageIcon className="h-4 w-4" aria-hidden="true" />
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
                className="min-h-64 w-full px-4 py-3 xl:py-2.5 text-sm leading-6 text-[#5F3B18] outline-none [&_a]:text-[#8B5A2B] [&_a]:underline [&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-semibold [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2"
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={saveSections} loading={sectionsLoading} label="Guardar páginas" />
        {sectionsMsg ? <span className="text-sm text-[#70471F]">{sectionsMsg}</span> : null}
      </div>
    </SectionCard>
  );
}

function ToolbarButton({
  onClick,
  label,
  strong,
  italic,
  underline,
}: {
  onClick: () => void;
  label: string;
  strong?: boolean;
  italic?: boolean;
  underline?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "h-9 rounded-xl border border-[#E5D7C8] px-3 text-sm text-[#70471F] hover:bg-[#F2ECE5]",
        strong ? "font-bold" : "font-semibold",
        italic ? "italic" : "",
        underline ? "underline" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-[#E5D7C8] bg-[#FAF8F5] px-5 py-10 xl:py-6 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#8B5A2B] shadow-sm">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="mt-4 font-semibold text-[#5F3B18]">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-[#8F6A49]">{description}</p>
    </div>
  );
}
