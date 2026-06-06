"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminSideNavProps = {
  isAdmin: boolean;
};

type NavItem = {
  href: string;
  label: string;
  newTab?: boolean;
};

function isActivePath(pathname: string, href: string) {
  if (href === "/admin") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminSideNav({ isAdmin }: AdminSideNavProps) {
  const pathname = usePathname();

  const baseItems: NavItem[] = [
    { href: "/admin", label: "Dashboard" },
    { href: "/admin/users", label: "Usuarios" },
    { href: "/admin/promociones", label: "Promociones" },
    { href: "/admin/estadisticas", label: "Estadísticas" },
    { href: "/admin/products", label: "Productos" },
    { href: "/admin/orders", label: "Pedidos" },
    { href: "/admin/paqueteria", label: "Paquetería" },
    { href: "/", label: "Ver Tienda", newTab: true },
  ];

  const adminOnlyItems: NavItem[] = [{ href: "/admin/users/new", label: "Alta merchant" }];
  const items = isAdmin ? [...baseItems, ...adminOnlyItems] : baseItems;

  return (
    <>
      <div className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 px-3 py-3 backdrop-blur md:hidden">
        <div className="flex gap-2 overflow-x-auto">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noopener noreferrer" : undefined}
                className={[
                  "whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm",
                  active
                    ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                    : "border-zinc-800 text-zinc-200 hover:bg-zinc-900/60",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-zinc-800 bg-zinc-950 p-4 md:block">
        <div className="px-2 pb-4 pt-1">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Admin</div>
          <div className="mt-1 text-lg font-semibold text-zinc-100">Panel</div>
        </div>

        <nav className="space-y-2">
          {items.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.newTab ? "_blank" : undefined}
                rel={item.newTab ? "noopener noreferrer" : undefined}
                className={[
                  "block rounded-xl border px-3 py-2 text-sm",
                  active
                    ? "border-zinc-100 bg-zinc-100 text-zinc-900"
                    : "border-zinc-800 text-zinc-200 hover:bg-zinc-900/60",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
