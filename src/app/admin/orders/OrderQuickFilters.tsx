"use client";

import { useRouter } from "next/navigation";
import FilterChips from "@/components/admin/data/FilterChips";

type OrderStatusFilter = "all" | "pending_payment" | "paid" | "shipped" | "delivered" | "cancelled" | "refunded";

type OrderQuickFiltersProps = {
  currentStatus: string;
  counts: Record<OrderStatusFilter, number>;
  baseParams: Record<string, string>;
};

export default function OrderQuickFilters({ currentStatus, counts, baseParams }: OrderQuickFiltersProps) {
  const router = useRouter();
  const value = isOrderStatusFilter(currentStatus) ? currentStatus : "all";

  return (
    <FilterChips
      ariaLabel="Filtros rápidos de pedidos"
      value={value}
      onChange={(nextValue) => {
        const params = new URLSearchParams({ ...baseParams, status: nextValue, page: "1" });
        for (const [key, paramValue] of params.entries()) {
          if (!paramValue.trim() || paramValue === "all") params.delete(key);
        }
        router.push(`/admin/orders?${params.toString()}`);
      }}
      options={[
        { value: "all", label: "Todos", count: counts.all },
        { value: "pending_payment", label: "Pendientes", count: counts.pending_payment },
        { value: "paid", label: "Pagados", count: counts.paid },
        { value: "shipped", label: "Enviados", count: counts.shipped },
        { value: "delivered", label: "Entregados", count: counts.delivered },
        { value: "cancelled", label: "Cancelados", count: counts.cancelled },
        { value: "refunded", label: "Reembolsados", count: counts.refunded },
      ].filter((option) => option.value === "all" || option.count > 0 || option.value === value)}
    />
  );
}

function isOrderStatusFilter(value: string): value is OrderStatusFilter {
  return ["all", "pending_payment", "paid", "shipped", "delivered", "cancelled", "refunded"].includes(value);
}
