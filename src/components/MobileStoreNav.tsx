"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  House,
  LogOut,
  Mail,
  Menu,
  Package,
  RefreshCcw,
  Ruler,
  ShoppingBag,
  Sparkles,
  Tag,
  UserRound,
  X,
  Shirt,
  type LucideIcon,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import CartLink from "@/components/CartLink";
import StoreSearch from "@/components/StoreSearch";

type CategoryOption = {
  id: string;
  parentId?: string | null;
  depth: number;
  name: string;
  slug: string;
  label?: string;
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

type CategoryNode = CategoryOption & {
  children: CategoryNode[];
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function categoryIcon(category: Pick<CategoryOption, "name" | "slug">): LucideIcon {
  const text = normalizeText(`${category.name} ${category.slug}`);
  if (
    text.includes("pijama") ||
    text.includes("pantalon") ||
    text.includes("camiseta") ||
    text.includes("remeron") ||
    text.includes("conjunto")
  ) {
    return Shirt;
  }
  if (text.includes("lenceria") || text.includes("top") || text.includes("bombi")) {
    return Sparkles;
  }
  if (text.includes("accesorio")) {
    return ShoppingBag;
  }
  if (text.includes("discontinu")) {
    return Tag;
  }
  return Package;
}

function informationIcon(section: InformationSection): LucideIcon {
  const text = normalizeText(`${section.title} ${section.slug}`);
  if (text.includes("politic") || text.includes("devol") || text.includes("cambio")) return RefreshCcw;
  if (text.includes("tabla") || text.includes("medida")) return Ruler;
  return Mail;
}

function renderIcon(Icon: LucideIcon, className: string) {
  return <Icon className={className} aria-hidden="true" />;
}

function buildCategoryTree(categories: CategoryOption[]) {
  const byParent = new Map<string, CategoryNode[]>();
  const nodes = new Map<string, CategoryNode>();

  for (const category of categories) {
    nodes.set(category.id, { ...category, children: [] });
  }

  for (const category of categories) {
    const node = nodes.get(category.id);
    if (!node) continue;
    const parentKey = category.parentId || "";
    byParent.set(parentKey, [...(byParent.get(parentKey) ?? []), node]);
  }

  for (const siblings of byParent.values()) {
    siblings.forEach((sibling) => {
      sibling.children = byParent.get(sibling.id) ?? [];
    });
  }

  return {
    roots: byParent.get("") ?? [],
    byId: nodes,
  };
}

function orderInformationSections(informationSections: InformationSection[]) {
  const sections = [...informationSections];
  const policy = sections.find((section) => {
    const text = normalizeText(`${section.title} ${section.slug}`);
    return text.includes("politic") || text.includes("devol") || text.includes("cambio");
  }) ?? null;
  const sizeGuide = sections.find((section) => {
    const text = normalizeText(`${section.title} ${section.slug}`);
    return text.includes("tabla") || text.includes("medida");
  }) ?? null;
  const used = new Set([policy?.id, sizeGuide?.id].filter(Boolean));
  const remaining = sections.filter((section) => !used.has(section.id));

  return {
    priority: [policy, sizeGuide].filter((section): section is InformationSection => Boolean(section)),
    remaining,
  };
}

export default function MobileStoreNav({
  logoUrl,
  categoryOptions,
  informationSections,
}: MobileStoreNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const isMerchant = session?.user?.role === "merchant";
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(true);

  const { roots, byId } = useMemo(() => buildCategoryTree(categoryOptions), [categoryOptions]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const selectedSlug = searchParams.get("category") || "";

  const selectedCategory = useMemo(
    () => categoryOptions.find((category) => category.slug === selectedSlug) ?? null,
    [categoryOptions, selectedSlug]
  );

  const selectedAncestorIds = useMemo(() => {
    const ids = new Set<string>();
    let currentParentId = selectedCategory?.parentId || null;

    while (currentParentId) {
      ids.add(currentParentId);
      currentParentId = byId.get(currentParentId)?.parentId || null;
    }

    return ids;
  }, [byId, selectedCategory]);

  const infoSections = useMemo(() => orderInformationSections(informationSections), [informationSections]);
  const effectiveExpandedIds = useMemo(() => {
    const next = new Set(expandedIds);
    for (const id of selectedAncestorIds) next.add(id);
    return next;
  }, [expandedIds, selectedAncestorIds]);

  function closeMenu() {
    setOpen(false);
  }

  function toggleCategory(categoryId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function isCategorySelected(category: CategoryOption) {
    return pathname.startsWith("/products") && selectedSlug === category.slug;
  }

  function isCategoryActive(category: CategoryNode) {
    return isCategorySelected(category) || selectedAncestorIds.has(category.id);
  }

  return (
    <div className="relative flex h-[74px] w-full items-center justify-between px-4 md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#F4EAE0] text-[#8B5A2B] transition hover:bg-[#EEDFCF]"
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <Link
        href="/"
        className="absolute left-1/2 top-1/2 block -translate-x-1/2 -translate-y-1/2"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Fika Pijamas" className="h-16 w-28 object-contain" />
      </Link>

      <div className="flex h-full items-center">
        <CartLink
          variant="store"
          compact
          searchSlot={<StoreSearch categories={categoryOptions} />}
        />
      </div>

      {open ? (
        <>
          <button
            type="button"
            onClick={closeMenu}
            className="absolute inset-x-0 top-full z-50 h-screen bg-[rgba(28,20,12,0.16)]"
            aria-label="Cerrar menú"
          />

          <aside
            className="absolute left-0 right-0 top-full z-[60] flex min-h-[calc(100vh-122px)] flex-col overflow-hidden border-t border-[#E8DCCF] bg-[#FCFAF6] text-[#6E4421] shadow-[0_18px_60px_rgba(53,32,14,0.12)]"
            aria-label="Menú de navegación"
          >
            <div className="flex-1 px-5 pb-8 pt-4">
              <div className="space-y-3">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#F4EAE0] text-[#8B5A2B] transition hover:bg-[#EADAC7]"
                    aria-label="Cerrar menú"
                  >
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>

                <MobileMenuLink
                  href="/"
                  label="Inicio"
                  icon={House}
                  active={pathname === "/"}
                  onClick={closeMenu}
                />

                <section className="rounded-[18px] border border-[#E9DCCF] bg-white/80 p-2 shadow-[0_8px_24px_rgba(81,52,25,0.05)]">
                  <button
                    type="button"
                    onClick={() => setProductsOpen((value) => !value)}
                    className={[
                      "flex min-h-[50px] w-full items-center justify-between rounded-xl px-3 text-left transition",
                      pathname.startsWith("/products")
                        ? "bg-[#F6EDE3] text-[#8B5A2B]"
                        : "hover:bg-[#FAF2E9]",
                    ].join(" ")}
                    aria-expanded={productsOpen}
                    aria-controls="mobile-products-panel"
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#F4E9DE] text-[#A46A39]">
                        {renderIcon(Package, "h-4.5 w-4.5")}
                      </span>
                      <span className="text-[15px] font-semibold tracking-[0.01em]">
                        Productos
                      </span>
                    </span>
                    {productsOpen
                      ? renderIcon(ChevronUp, "h-4.5 w-4.5")
                      : renderIcon(ChevronDown, "h-4.5 w-4.5")}
                  </button>

                  <div
                    id="mobile-products-panel"
                    className={[
                      "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                      productsOpen ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0",
                    ].join(" ")}
                  >
                    <div className="space-y-1.5 px-2 pb-2 pt-1">
                      <MobileMenuLink
                        href="/products"
                        label="Todos los productos"
                        icon={Package}
                        compact
                        active={pathname === "/products" && !selectedSlug}
                        onClick={closeMenu}
                      />

                      {roots.map((category) => (
                        <MobileCategoryItem
                          key={category.id}
                          category={category}
                          expandedIds={effectiveExpandedIds}
                          selectedAncestorIds={selectedAncestorIds}
                          isSelected={isCategorySelected}
                          isActive={isCategoryActive}
                          onToggle={toggleCategory}
                          onClose={closeMenu}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                <div className="border-t border-[#E7D8C9] pt-3">
                  <div className="space-y-1.5">
                    {infoSections.priority.map((section) => (
                      <MobileMenuLink
                        key={section.id}
                        href={`/informacion/${section.slug}`}
                        label={section.title}
                        icon={informationIcon(section)}
                        active={pathname === `/informacion/${section.slug}`}
                        trailing
                        onClick={closeMenu}
                      />
                    ))}

                    {infoSections.remaining.map((section) => (
                      <MobileMenuLink
                        key={section.id}
                        href={`/informacion/${section.slug}`}
                        label={section.title}
                        icon={informationIcon(section)}
                        active={pathname === `/informacion/${section.slug}`}
                        trailing
                        onClick={closeMenu}
                      />
                    ))}

                    <MobileMenuLink
                      href="/register"
                      label="Contacto"
                      icon={Mail}
                      active={pathname === "/register"}
                      trailing
                      onClick={closeMenu}
                    />
                  </div>
                </div>

                <div className="border-t border-[#E7D8C9] pt-3">
                  {session?.user?.email ? (
                    <Link
                      href="/account/profile"
                      onClick={closeMenu}
                      className="flex items-center justify-between rounded-2xl bg-[#F7EFE6] px-4 py-3.5 transition hover:bg-[#F1E5D8]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#A46A39] shadow-sm">
                          <UserRound className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[#7B4B24]">
                            Cuenta
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-[#A07854]">
                            {session.user.email}
                          </span>
                        </span>
                      </span>
                      <ChevronRight
                        className="h-4.5 w-4.5 shrink-0 text-[#A46A39]"
                        aria-hidden="true"
                      />
                    </Link>
                  ) : (
                    <MobileMenuLink
                      href="/login"
                      label="Cuenta"
                      icon={UserRound}
                      active={pathname === "/login"}
                      trailing
                      onClick={closeMenu}
                    />
                  )}

                  <div className="mt-2 space-y-1.5">
                    <MobileMenuLink
                      href="/account/orders"
                      label="Mis pedidos"
                      icon={ClipboardList}
                      active={pathname.startsWith("/account/orders")}
                      trailing
                      onClick={closeMenu}
                    />

                    {isMerchant ? (
                      <MobileMenuLink
                        href="/admin"
                        label="Admin de tienda"
                        icon={Package}
                        active={pathname.startsWith("/admin")}
                        trailing
                        onClick={closeMenu}
                      />
                    ) : null}

                    {session?.user?.email ? (
                      <button
                        type="button"
                        onClick={() => {
                          closeMenu();
                          void signOut({ callbackUrl: "/" });
                        }}
                        className="flex min-h-[50px] w-full items-center gap-3 rounded-xl px-4 text-left text-sm font-medium text-[#6E4421] transition hover:bg-[#F6EDE3]"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4E9DE] text-[#A46A39]">
                          <LogOut className="h-4.5 w-4.5" aria-hidden="true" />
                        </span>
                        <span>Cerrar sesión</span>
                      </button>
                    ) : (
                      <MobileMenuLink
                        href="/register"
                        label="Crear cuenta"
                        icon={UserRound}
                        active={pathname === "/register"}
                        trailing
                        onClick={closeMenu}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}

function MobileCategoryItem({
  category,
  expandedIds,
  selectedAncestorIds,
  isSelected,
  isActive,
  onToggle,
  onClose,
}: {
  category: CategoryNode;
  expandedIds: Set<string>;
  selectedAncestorIds: Set<string>;
  isSelected: (category: CategoryOption) => boolean;
  isActive: (category: CategoryNode) => boolean;
  onToggle: (categoryId: string) => void;
  onClose: () => void;
}) {
  const Icon = categoryIcon(category);
  const hasChildren = category.children.length > 0;
  const isExpanded = expandedIds.has(category.id);
  const active = isActive(category);

  return (
    <div className="space-y-1">
      <div className={["rounded-xl transition", active ? "bg-[#F6EDE3]" : ""].join(" ")}>
        <div className="flex items-center gap-2">
          <Link
            href={`/products?category=${category.slug}`}
            onClick={onClose}
            className="flex min-h-[50px] min-w-0 flex-1 items-center gap-3 px-3"
          >
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4E9DE] text-[#A46A39]">
              {renderIcon(Icon, "h-4.5 w-4.5")}
            </span>
            <span className="min-w-0 text-[14px] font-medium text-[#704622]">
              {category.name}
            </span>
          </Link>

          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(category.id)}
              className="mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#9D6B43] transition hover:bg-[#F1E3D5]"
              aria-expanded={isExpanded}
              aria-controls={`mobile-category-${category.id}`}
            >
              {isExpanded
                ? renderIcon(ChevronUp, "h-4.5 w-4.5")
                : renderIcon(ChevronDown, "h-4.5 w-4.5")}
            </button>
          ) : null}
        </div>
      </div>

      {hasChildren ? (
        <div
          id={`mobile-category-${category.id}`}
          className={[
            "overflow-hidden pl-12 transition-[max-height,opacity] duration-200 ease-out",
            isExpanded ? "max-h-[720px] opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <div className="space-y-1 border-l border-[#E7D8C9] py-1 pl-3">
            {category.children.map((child) => {
              const childActive = isSelected(child) || selectedAncestorIds.has(child.id);
              const ChildIcon = categoryIcon(child);

              if (child.children.length > 0) {
                return (
                  <MobileCategoryItem
                    key={child.id}
                    category={child}
                    expandedIds={expandedIds}
                    selectedAncestorIds={selectedAncestorIds}
                    isSelected={isSelected}
                    isActive={isActive}
                    onToggle={onToggle}
                    onClose={onClose}
                  />
                );
              }

              return (
                <Link
                  key={child.id}
                  href={`/products?category=${child.slug}`}
                  onClick={onClose}
                  className={[
                    "flex min-h-[38px] items-center gap-2 rounded-lg px-3 text-[13px] transition",
                    childActive
                      ? "bg-[#F6EDE3] font-medium text-[#8B5A2B]"
                      : "text-[#9A6A45] hover:bg-[#FAF2E9]",
                  ].join(" ")}
                >
                  {renderIcon(ChildIcon, "h-3.5 w-3.5 shrink-0 text-[#B07A4A]")}
                  <span>{child.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MobileMenuLink({
  href,
  label,
  icon: Icon,
  active = false,
  compact = false,
  trailing = false,
  onClick,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  compact?: boolean;
  trailing?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={[
        "flex items-center justify-between rounded-xl px-4 transition",
        compact ? "min-h-[42px]" : "min-h-[50px]",
        active ? "bg-[#F6EDE3] text-[#8B5A2B]" : "text-[#704622] hover:bg-[#FAF2E9]",
      ].join(" ")}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F4E9DE] text-[#A46A39]">
          {renderIcon(Icon, "h-4.5 w-4.5")}
        </span>
        <span className={compact ? "text-[13px] font-medium" : "text-[14px] font-medium"}>
          {label}
        </span>
      </span>
      {trailing ? renderIcon(ChevronRight, "h-4.5 w-4.5 shrink-0 text-[#A46A39]") : null}
    </Link>
  );
}
