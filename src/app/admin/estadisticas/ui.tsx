"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ChartNoAxesColumnIncreasing,
  Package,
  PackageCheck,
  Search,
  ShoppingBag,
  Tags,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import PageToolbar from "@/components/admin/layout/PageToolbar";
import SectionCard from "@/components/admin/cards/SectionCard";
import StatCard from "@/components/admin/cards/StatCard";
import DataTable, { type DataTableColumn } from "@/components/admin/data/DataTable";
import EmptyState from "@/components/admin/data/EmptyState";
import FilterChips from "@/components/admin/data/FilterChips";
import SearchBar from "@/components/admin/data/SearchBar";
import StatusBadge from "@/components/admin/data/StatusBadge";

type SalesOrder = {
  id: string;
  orderNumber: number;
  total: number;
  status: string;
  userId: string;
  createdAt: string;
  items: {
    id: string;
    productId: string;
    nameSnapshot: string;
    unitPrice: number;
    quantity: number;
    subtotal: number;
    product: {
      id: string;
      name: string;
      slug: string;
      stock: number;
      isActive: boolean;
      imageUrl: string | null;
      category: { id: string; name: string; slug: string } | null;
    } | null;
  }[];
};

type LowStockProduct = {
  id: string;
  name: string;
  slug: string;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
};

type PeriodKey = "all" | "today" | "7d" | "30d" | "month";
type InventoryFilter = "all" | "out" | "critical" | "low";

const periodOptions: { value: PeriodKey; label: string }[] = [
  { value: "all", label: "Todo el historial" },
  { value: "today", label: "Hoy" },
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "month", label: "Este mes" },
];

const inventoryFilters: { value: InventoryFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "out", label: "Sin stock" },
  { value: "critical", label: "Crítico" },
  { value: "low", label: "Bajo" },
];

function money(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function fullDate(value: string) {
  const date = new Date(value);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getPeriodStart(period: PeriodKey) {
  const now = new Date();
  if (period === "all") return null;
  if (period === "today") return startOfDay(now);
  if (period === "7d") {
    const date = startOfDay(now);
    date.setDate(date.getDate() - 6);
    return date;
  }
  if (period === "30d") {
    const date = startOfDay(now);
    date.setDate(date.getDate() - 29);
    return date;
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function splitProductName(name: string) {
  const [base, ...rest] = name.split(" - ");
  return {
    baseName: base?.trim() || name,
    variantName: rest.join(" - ").trim(),
  };
}

function inventoryStatus(stock: number) {
  if (stock <= 0) return { key: "out" as const, label: "Sin stock", variant: "danger" as const };
  if (stock <= 2) return { key: "critical" as const, label: "Stock crítico", variant: "warning" as const };
  if (stock <= 4) return { key: "low" as const, label: "Stock bajo", variant: "warning" as const };
  return { key: "ok" as const, label: "Stock correcto", variant: "success" as const };
}

export default function AdminStatsDashboard({
  salesOrders,
  lowStockProducts,
  salesStatuses,
}: {
  salesOrders: SalesOrder[];
  lowStockProducts: LowStockProduct[];
  salesStatuses: string[];
}) {
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [inventoryFilter, setInventoryFilter] = useState<InventoryFilter>("all");
  const [inventoryQuery, setInventoryQuery] = useState("");

  const periodStart = getPeriodStart(period);
  const periodLabel = periodOptions.find((option) => option.value === period)?.label || "Todo el historial";
  const ordersInPeriod = useMemo(() => {
    if (!periodStart) return salesOrders;
    return salesOrders.filter((order) => new Date(order.createdAt) >= periodStart);
  }, [periodStart, salesOrders]);

  const totalRevenue = ordersInPeriod.reduce((sum, order) => sum + order.total, 0);
  const orderCount = ordersInPeriod.length;
  const averageTicket = orderCount > 0 ? totalRevenue / orderCount : 0;
  const buyerCount = new Set(ordersInPeriod.map((order) => order.userId)).size;
  const unitsSold = ordersInPeriod.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);

  const productRanking = useMemo(() => {
    const byProduct = new Map<string, {
      productId: string;
      name: string;
      baseName: string;
      variantName: string;
      units: number;
      revenue: number;
      imageUrl: string | null;
      categoryName: string | null;
    }>();

    for (const order of ordersInPeriod) {
      for (const item of order.items) {
        const key = item.productId || item.nameSnapshot;
        const split = splitProductName(item.product?.name || item.nameSnapshot);
        const current = byProduct.get(key);
        byProduct.set(key, {
          productId: key,
          name: item.product?.name || item.nameSnapshot,
          baseName: split.baseName,
          variantName: split.variantName,
          units: (current?.units ?? 0) + item.quantity,
          revenue: (current?.revenue ?? 0) + item.subtotal,
          imageUrl: current?.imageUrl ?? item.product?.imageUrl ?? null,
          categoryName: item.product?.category?.name || current?.categoryName || null,
        });
      }
    }

    return [...byProduct.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
  }, [ordersInPeriod]);

  const topProduct = productRanking[0] ?? null;

  const categoryRanking = useMemo(() => {
    const byCategory = new Map<string, { name: string; units: number; revenue: number }>();
    for (const order of ordersInPeriod) {
      for (const item of order.items) {
        const name = item.product?.category?.name || "Sin categoría";
        const current = byCategory.get(name);
        byCategory.set(name, {
          name,
          units: (current?.units ?? 0) + item.quantity,
          revenue: (current?.revenue ?? 0) + item.subtotal,
        });
      }
    }
    return [...byCategory.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [ordersInPeriod]);

  const salesByDay = useMemo(() => {
    const byDay = new Map<string, { date: string; revenue: number; orders: number }>();
    for (const order of ordersInPeriod) {
      const key = new Date(order.createdAt).toISOString().slice(0, 10);
      const current = byDay.get(key);
      byDay.set(key, {
        date: key,
        revenue: (current?.revenue ?? 0) + order.total,
        orders: (current?.orders ?? 0) + 1,
      });
    }
    return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [ordersInPeriod]);

  const inventorySummary = useMemo(() => {
    return {
      total: lowStockProducts.length,
      out: lowStockProducts.filter((product) => inventoryStatus(product.stock).key === "out").length,
      critical: lowStockProducts.filter((product) => inventoryStatus(product.stock).key === "critical").length,
      low: lowStockProducts.filter((product) => inventoryStatus(product.stock).key === "low").length,
    };
  }, [lowStockProducts]);

  const filteredInventory = useMemo(() => {
    const q = inventoryQuery.trim().toLowerCase();
    return lowStockProducts.filter((product) => {
      const status = inventoryStatus(product.stock).key;
      const split = splitProductName(product.name);
      const matchesFilter = inventoryFilter === "all" || status === inventoryFilter;
      const matchesQuery = !q || `${product.name} ${split.baseName} ${split.variantName}`.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [inventoryFilter, inventoryQuery, lowStockProducts]);

  const inventoryFilterOptions = inventoryFilters.map((option) => ({
    ...option,
    count:
      option.value === "all"
        ? inventorySummary.total
        : option.value === "out"
          ? inventorySummary.out
          : option.value === "critical"
            ? inventorySummary.critical
            : inventorySummary.low,
  }));

  const inventoryColumns: DataTableColumn<LowStockProduct>[] = [
    {
      key: "product",
      header: "Producto",
      cell: (product) => {
        const split = splitProductName(product.name);
        return (
          <div className="flex items-center gap-3">
            <ProductThumb product={product} />
            <div>
              <div className="font-semibold text-[var(--admin-text)]">{split.baseName}</div>
              <div className="mt-1 text-xs text-[var(--admin-muted)]">/{product.slug}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: "variant",
      header: "Variante",
      cell: (product) => <span className="text-[var(--admin-text-soft)]">{splitProductName(product.name).variantName || "Única variante"}</span>,
    },
    {
      key: "stock",
      header: "Stock",
      cell: (product) => <span className="font-semibold text-[var(--admin-text)]">{product.stock} unidades</span>,
    },
    {
      key: "inventory",
      header: "Estado de inventario",
      cell: (product) => {
        const status = inventoryStatus(product.stock);
        return <StatusBadge label={status.label} variant={status.variant} />;
      },
    },
    {
      key: "publication",
      header: "Publicación",
      cell: (product) => <StatusBadge label={product.isActive ? "Activo" : "Inactivo"} variant={product.isActive ? "success" : "neutral"} />,
    },
    {
      key: "action",
      header: "Acción",
      headerClassName: "text-right",
      className: "text-right",
      cell: (product) => (
        <Link
          href={`/admin/products/${product.id}`}
          className="inline-flex rounded-xl border border-[var(--admin-border)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
        >
          Editar
        </Link>
      ),
    },
  ];

  const insights = [
    topProduct ? `${topProduct.baseName} fue el producto más vendido (${topProduct.units} unidades).` : null,
    orderCount > 0 ? `El ticket promedio fue de ${money(averageTicket)}.` : null,
    `Se consideraron ${orderCount} pedido${orderCount === 1 ? "" : "s"} con estado ${salesStatuses.join(" / ")}.`,
    inventorySummary.out > 0 ? `Hay ${inventorySummary.out} producto${inventorySummary.out === 1 ? "" : "s"} sin stock.` : null,
    inventorySummary.total === 0 ? "No hay productos con stock bajo." : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <main className="min-h-screen bg-[var(--admin-background)] text-[var(--admin-text-soft)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:py-6">
        <AdminPageHeader
          eyebrow="Admin · Estadísticas"
          title="Estadísticas"
          subtitle="Analizá el rendimiento comercial y el estado del inventario de tu tienda."
          backHref="/admin"
        />

        <SectionCard className="mt-8 xl:mt-6">
          <PageToolbar
            title="Período"
            description={`Métricas calculadas sobre: ${periodLabel}. Pedidos considerados: ${salesStatuses.join(" / ")}.`}
            filters={<FilterChips options={periodOptions} value={period} onChange={setPeriod} ariaLabel="Seleccionar período de estadísticas" />}
          />
        </SectionCard>

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard icon={Wallet} title="Ventas totales" value={money(totalRevenue)} description="Pedidos pagados/enviados" />
          <StatCard icon={ShoppingBag} title="Pedidos" value={orderCount} description="Considerados en el período" />
          <StatCard icon={TrendingUp} title="Ticket promedio" value={orderCount > 0 ? money(averageTicket) : "0"} description="Promedio por pedido" />
          <StatCard icon={Users} title="Clientes compradores" value={buyerCount} description="Clientes con ventas consideradas" />
          <StatCard icon={Package} title="Producto más vendido" value={topProduct?.baseName || "Sin ventas"} description={topProduct ? `${topProduct.units} unidad${topProduct.units === 1 ? "" : "es"} vendida${topProduct.units === 1 ? "" : "s"}` : "No hay datos suficientes"} />
          <StatCard icon={Boxes} title="Unidades vendidas" value={unitsSold} description="Suma de productos vendidos" />
        </section>

        <section className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <SectionCard title="Ventas en el tiempo" description="Monto vendido por día dentro del período seleccionado.">
            <SalesChart data={salesByDay} />
          </SectionCard>

          <SectionCard title="Resumen del período" description="Lectura rápida con datos reales.">
            <ul className="space-y-3">
              {insights.map((insight) => (
                <li key={insight} className="flex gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text-soft)]">
                  <ChartNoAxesColumnIncreasing className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
                  {insight}
                </li>
              ))}
            </ul>
          </SectionCard>
        </section>

        <section className="mt-8 xl:mt-6 grid gap-6 xl:gap-4 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Productos más vendidos" description="Ranking por unidades vendidas.">
            {productRanking.length > 0 ? (
              <div className="space-y-3">
                {productRanking.slice(0, 10).map((product, index) => (
                  <TopProductRow key={product.productId} product={product} index={index} maxUnits={productRanking[0]?.units || 1} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Package}
                title="Todavía no hay ventas suficientes."
                description="Los productos más vendidos aparecerán cuando recibas pedidos pagados o enviados."
              />
            )}
          </SectionCard>

          <SectionCard title="Rendimiento por categorías" description="Ventas agrupadas por categoría de producto.">
            {categoryRanking.length > 0 ? (
              <div className="space-y-3">
                {categoryRanking.map((category) => (
                  <div key={category.name} className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-semibold text-[var(--admin-text)]">{category.name}</div>
                        <div className="mt-1 text-sm text-[var(--admin-muted)]">{category.units} unidades vendidas</div>
                      </div>
                      <div className="text-right font-semibold text-[var(--admin-text)]">{money(category.revenue)}</div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                      <div
                        className="h-full rounded-full bg-[var(--admin-primary)]"
                        style={{ width: `${totalRevenue > 0 ? Math.max(4, (category.revenue / totalRevenue) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Tags}
                title="Todavía no hay suficientes datos para comparar categorías."
                description="Esta sección se completará cuando haya ventas asociadas a categorías."
              />
            )}
          </SectionCard>
        </section>

        <section className="mt-8 xl:mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={AlertTriangle} title="Total con stock bajo" value={inventorySummary.total} description="Menos de 5 unidades" />
          <StatCard icon={AlertTriangle} title="Sin stock" value={inventorySummary.out} description="Stock igual a 0" />
          <StatCard icon={Package} title="Stock crítico" value={inventorySummary.critical} description="Entre 1 y 2 unidades" />
          <StatCard icon={PackageCheck} title="Stock bajo" value={inventorySummary.low} description="Entre 3 y 4 unidades" />
        </section>

        <SectionCard className="mt-8 xl:mt-6">
          <PageToolbar
            title="Alertas de inventario"
            description="Productos y variantes que necesitan reposición."
            search={
              <SearchBar
                value={inventoryQuery}
                onChange={setInventoryQuery}
                placeholder="Buscar producto o variante..."
                ariaLabel="Buscar producto o variante con stock bajo"
              />
            }
            filters={<FilterChips options={inventoryFilterOptions} value={inventoryFilter} onChange={setInventoryFilter} ariaLabel="Filtrar alertas de inventario" />}
          />

          <div className="mt-5">
            {filteredInventory.length > 0 ? (
              <DataTable
                columns={inventoryColumns}
                data={filteredInventory}
                rowKey={(product) => product.id}
                caption="Alertas de inventario"
              />
            ) : lowStockProducts.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="No hay productos con stock bajo."
                description="El inventario está en buen estado."
              />
            ) : (
              <EmptyState
                icon={Search}
                title="No encontramos productos con esos filtros."
                description="Probá cambiar la búsqueda o volver al filtro Todos."
              />
            )}
          </div>
        </SectionCard>
      </div>
    </main>
  );
}

function SalesChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  if (data.length < 2) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Todavía no hay suficientes ventas para mostrar una tendencia."
        description="Las estadísticas se completarán a medida que recibas pedidos."
      />
    );
  }

  const maxRevenue = Math.max(...data.map((item) => item.revenue), 1);

  return (
    <div>
      <div className="flex h-72 items-end gap-2 rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-4">
        {data.map((item) => (
          <div key={item.date} className="flex h-full min-w-8 flex-1 flex-col justify-end gap-2">
            <div className="flex flex-1 items-end">
              <div
                className="w-full rounded-t-xl bg-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-primary-hover)]"
                style={{ height: `${Math.max(4, (item.revenue / maxRevenue) * 100)}%` }}
                title={`${fullDate(item.date)} · ${money(item.revenue)} · ${item.orders} pedido${item.orders === 1 ? "" : "s"}`}
                aria-label={`${fullDate(item.date)}: ${money(item.revenue)} en ${item.orders} pedido${item.orders === 1 ? "" : "s"}`}
              />
            </div>
            <div className="truncate text-center text-[11px] text-[var(--admin-muted)]">{formatDate(item.date)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-[var(--admin-muted)]">
        Cada barra representa el monto vendido por día. Pasá el cursor para ver el detalle.
      </p>
    </div>
  );
}

function TopProductRow({
  product,
  index,
  maxUnits,
}: {
  product: {
    productId: string;
    baseName: string;
    variantName: string;
    units: number;
    revenue: number;
    imageUrl: string | null;
    categoryName: string | null;
  };
  index: number;
  maxUnits: number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-primary)] text-sm font-bold text-white">
          {index + 1}
        </div>
        <ProductThumb product={{ name: product.baseName, imageUrl: product.imageUrl }} />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-[var(--admin-text)]">{product.baseName}</div>
          <div className="mt-1 truncate text-sm text-[var(--admin-muted)]">
            {product.variantName || product.categoryName || "Producto"}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold text-[var(--admin-text)]">{product.units} u.</div>
          <div className="mt-1 text-sm text-[var(--admin-muted)]">{money(product.revenue)}</div>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[var(--admin-primary)]" style={{ width: `${Math.max(5, (product.units / maxUnits) * 100)}%` }} />
      </div>
    </div>
  );
}

function ProductThumb({ product }: { product: { name: string; imageUrl: string | null } }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-white">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
      ) : (
        <Package className="h-5 w-5 text-[var(--admin-muted-2)]" aria-hidden="true" />
      )}
    </div>
  );
}
