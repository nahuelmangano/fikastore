"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BadgePercent,
  BarChart3,
  CreditCard,
  ChevronDown,
  FileText,
  FolderTree,
  Globe,
  Home,
  LayoutGrid,
  LogOut,
  Mail,
  Monitor,
  MessageCircle,
  Menu,
  X,
  Package,
  Paintbrush,
  RefreshCw,
  Share2,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type AdminSideNavProps = {
  isAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  newTab?: boolean;
  query?: string;
  children?: NavItem[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function navHref(item: NavItem) {
  return item.query ? `${item.href}?tab=${item.query}` : item.href;
}

export default function AdminSideNav({ isAdmin }: AdminSideNavProps) {
  const mobileDialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [settingsOpen, setSettingsOpen] = useState(pathname.startsWith("/admin/settings"));
  const [promotionsOpen, setPromotionsOpen] = useState(pathname.startsWith("/admin/promociones"));

  useEffect(() => {
    const dialog = mobileDialog.current;
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => {
      if (desktop.matches) dialog?.close();
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const isItemActive = (item: NavItem) =>
    item.query
      ? pathname === item.href && searchParams.get("tab") === item.query
      : isActivePath(pathname, item.href);

  const settingsChildren: NavItem[] = [
    { href: "/admin/settings", query: "appearance", label: "Apariencia", icon: Paintbrush },
    { href: "/admin/settings", query: "home", label: "Inicio", icon: Home },
    { href: "/admin/settings", query: "content", label: "Contenido", icon: Monitor },
    { href: "/admin/settings", query: "pages", label: "Páginas", icon: FileText },
    { href: "/admin/settings", query: "categories", label: "Categorías", icon: LayoutGrid },
    { href: "/admin/settings", query: "payments", label: "Medios de pago", icon: CreditCard },
    { href: "/admin/settings", query: "social", label: "Redes", icon: Share2 },
    { href: "/admin/settings", query: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { href: "/admin/settings", query: "domain", label: "Dominio", icon: Globe },
    { href: "/admin/settings", query: "analytics", label: "Analíticas", icon: BarChart3 },
  ];
  const promotionsChildren: NavItem[] = [
    { href: "/admin/promociones", query: "global", label: "Descuento general", icon: BadgePercent },
    { href: "/admin/promociones", query: "product", label: "Por producto", icon: ShoppingBag },
    { href: "/admin/promociones", query: "code", label: "Código promocional", icon: Share2 },
    { href: "/admin/promociones", query: "shipping", label: "Envío gratis", icon: Truck },
    { href: "/admin/promociones", query: "installments", label: "Cuotas", icon: CreditCard },
  ];

  const groups: NavGroup[] = [
    {
      label: "General",
      items: [
        { href: "/admin", label: "Dashboard", icon: Home },
        { href: "/admin/users", label: "Usuarios", icon: Users },
        { href: "/admin/estadisticas", label: "Estadísticas", icon: BarChart3 },
      ],
    },
    {
      label: "Catálogo",
      items: [
        { href: "/admin/products", label: "Productos", icon: ShoppingBag },
        { href: "/admin/categories", label: "Categorias", icon: FolderTree },
        { href: "/admin/promociones", label: "Promociones", icon: BadgePercent, children: promotionsChildren },
      ],
    },
    {
      label: "Ventas",
      items: [
        { href: "/admin/orders", label: "Pedidos", icon: Package },
        { href: "/admin/paqueteria", label: "Paquetería", icon: Truck },
        { href: "/admin/arrepentimientos", label: "Arrepentimientos", icon: RefreshCw },
      ],
    },
    {
      label: "Sistema",
      items: [
        { href: "/admin/mailing", label: "Mailing", icon: Mail },
        ...(isAdmin ? [{ href: "/admin/pantallas", label: "Pantallas", icon: Monitor }] : []),
        { href: "/admin/settings", label: "Configuracion", icon: Settings, children: settingsChildren },
        { href: "/", label: "Ver Tienda", icon: Store, newTab: true },
        ...(isAdmin ? [{ href: "/admin/users/new", label: "Alta merchant", icon: CreditCard }] : []),
      ],
    },
  ];

  const navigation = (
    <>
        <div className="flex items-center gap-3 rounded-2xl border border-[#EADCCD] bg-white/55 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5A2B] text-white shadow-sm">
            <Store className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight tracking-wide text-[#70471F]">FIKA</div>
            <div className="text-xs font-medium text-[#A37A55]">Admin Panel</div>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="mt-6 min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain pr-1">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#B18B68]">
                {group.label}
              </div>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const active = isItemActive(item);
                  const Icon = item.icon;
                  const itemLink = (
                    <Link
                      href={navHref(item)}
                      target={item.newTab ? "_blank" : undefined}
                      rel={item.newTab ? "noopener noreferrer" : undefined}
                      className={[
                        "group relative flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition duration-150",
                        active
                          ? "bg-[#8B5A2B] font-semibold text-white shadow-sm"
                          : "text-[#7B522E] hover:translate-x-1 hover:bg-[#F2ECE5]",
                      ].join(" ")}
                    >
                      {active ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-white/80" /> : null}
                      <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  );

                  if (!item.children) return <div key={item.href}>{itemLink}</div>;

                  return (
                    <div key={item.href}>
                      <div className="flex items-center gap-1">
                        {itemLink}
                        <button
                          type="button"
                          aria-label={(item.href === "/admin/settings" ? settingsOpen : promotionsOpen) ? `Ocultar submenú de ${item.label.toLowerCase()}` : `Mostrar submenú de ${item.label.toLowerCase()}`}
                          aria-expanded={item.href === "/admin/settings" ? settingsOpen : promotionsOpen}
                          onClick={() => item.href === "/admin/settings" ? setSettingsOpen((open) => !open) : setPromotionsOpen((open) => !open)}
                          className="rounded-lg p-2 text-[#7B522E] hover:bg-[#F2ECE5]"
                        >
                          <ChevronDown className={["h-4 w-4 transition-transform", (item.href === "/admin/settings" ? settingsOpen : promotionsOpen) ? "rotate-180" : ""].join(" ")} aria-hidden="true" />
                        </button>
                      </div>
                      {(item.href === "/admin/settings" ? settingsOpen : promotionsOpen) ? (
                        <div className="ml-5 mt-1 space-y-1 border-l border-[#E5D7C8] pl-2">
                          {item.children.map((child) => {
                            const childActive = isItemActive(child);
                            const ChildIcon = child.icon;
                            return (
                              <Link
                                key={child.query}
                                href={navHref(child)}
                                className={[
                                  "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition duration-150",
                                  childActive ? "bg-[#8B5A2B] font-semibold text-white" : "text-[#8F6A49] hover:bg-[#F2ECE5]",
                                ].join(" ")}
                              >
                                <ChildIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                <span>{child.label}</span>
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#E5D7C8] pt-4">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-xl border border-[#E5D7C8] bg-white/40 px-3 py-2.5 text-left text-[15px] font-medium text-[#7B522E] transition duration-150 hover:translate-x-1 hover:bg-[#F2ECE5]"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
    </>
  );

  function closeMobileMenu() {
    mobileDialog.current?.close();
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-[#E5D7C8] bg-[#FAF8F5]/95 px-3 py-3 text-[#8B5A2B] backdrop-blur md:hidden">
        <button
          type="button"
          aria-label="Abrir menú de navegación"
          aria-haspopup="dialog"
          aria-controls="admin-mobile-navigation"
          onClick={() => mobileDialog.current?.showModal()}
          className="flex items-center gap-2 rounded-xl border border-[#E5D7C8] px-3 py-2 text-sm font-semibold"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          Menú
        </button>
        <span className="text-sm font-semibold">FIKA · Admin Panel</span>
      </div>

      <dialog
        ref={mobileDialog}
        id="admin-mobile-navigation"
        aria-label="Navegación del panel"
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-80 max-w-[90vw] border-0 bg-[#FAF8F5] p-0 text-[#8B5A2B] shadow-xl backdrop:bg-black/40"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeMobileMenu();
          if ((event.target as HTMLElement).closest("a")) closeMobileMenu();
        }}
      >
        <div className="flex h-full min-h-0 flex-col px-4 pb-5 pt-3">
          <button
            type="button"
            autoFocus
            onClick={closeMobileMenu}
            className="mb-3 flex shrink-0 items-center gap-2 self-end rounded-xl px-3 py-2 text-sm hover:bg-[#F2ECE5]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
            Cerrar menú
          </button>
          {navigation}
        </div>
      </dialog>
      <style>{`body:has(#admin-mobile-navigation[open]) { overflow: hidden; }`}</style>

      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-[#E5D7C8] bg-[#FAF8F5] px-4 py-5 text-[#8B5A2B] shadow-[4px_0_24px_rgba(80,52,28,0.06)] md:flex">
        {navigation}
      </aside>
    </>
  );
}
