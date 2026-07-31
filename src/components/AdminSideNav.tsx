"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BadgePercent,
  BarChart3,
  CreditCard,
  FolderTree,
  Home,
  LogOut,
  Mail,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";

type AdminSideNavProps = {
  isAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  newTab?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSideNav({ isAdmin }: AdminSideNavProps) {
  const pathname = usePathname();

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
        { href: "/admin/promociones", label: "Promociones", icon: BadgePercent },
      ],
    },
    {
      label: "Ventas",
      items: [
        { href: "/admin/orders", label: "Pedidos", icon: Package },
        { href: "/admin/paqueteria", label: "Paquetería", icon: Truck },
      ],
    },
    {
      label: "Sistema",
      items: [
        { href: "/admin/mailing", label: "Mailing", icon: Mail },
        { href: "/admin/settings", label: "Configuracion", icon: Settings },
        { href: "/", label: "Ver Tienda", icon: Store, newTab: true },
        ...(isAdmin ? [{ href: "/admin/users/new", label: "Alta merchant", icon: CreditCard }] : []),
      ],
    },
  ];

  const items = groups.flatMap((group) => group.items);

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-[#E5D7C8] bg-[#FAF8F5]/95 px-3 py-3 text-[#8B5A2B] backdrop-blur md:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noopener noreferrer" : undefined}
                className={[
                  "flex whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition duration-150",
                  active
                    ? "border-[#8B5A2B] bg-[#8B5A2B] font-semibold text-white"
                    : "border-[#E5D7C8] text-[#8B5A2B] hover:bg-[#F2ECE5]",
                ].join(" ")}
              >
                <Icon className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex whitespace-nowrap rounded-xl border border-[#E5D7C8] px-3 py-2 text-sm text-[#8B5A2B] transition duration-150 hover:bg-[#F2ECE5]"
          >
            <LogOut className="mr-2 h-4 w-4 shrink-0" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </div>

      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#E5D7C8] bg-[#FAF8F5] px-4 py-5 text-[#8B5A2B] shadow-[4px_0_24px_rgba(80,52,28,0.06)] md:flex md:flex-col">
        <div className="flex items-center gap-3 rounded-2xl border border-[#EADCCD] bg-white/55 px-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#8B5A2B] text-white shadow-sm">
            <Store className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight tracking-wide text-[#70471F]">FIKA</div>
            <div className="text-xs font-medium text-[#A37A55]">Admin Panel</div>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-[#B18B68]">
                {group.label}
              </div>
              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      target={item.newTab ? "_blank" : undefined}
                      rel={item.newTab ? "noopener noreferrer" : undefined}
                      className={[
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition duration-150",
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
      </aside>
    </>
  );
}
