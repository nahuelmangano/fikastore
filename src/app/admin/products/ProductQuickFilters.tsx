"use client";

import { useRouter } from "next/navigation";
import FilterChips from "@/components/admin/data/FilterChips";

type StatusFilter = "all" | "active" | "inactive" | "oos" | "low" | "variants";

type ProductQuickFiltersProps = {
  currentStatus: string;
  counts: Record<StatusFilter, number>;
  baseParams: Record<string, string>;
};

export default function ProductQuickFilters({ currentStatus, counts, baseParams }: ProductQuickFiltersProps) {
  const router = useRouter();
  const value = isStatusFilter(currentStatus) ? currentStatus : "all";

  return (
    <FilterChips
      ariaLabel="Filtros rápidos de productos"
      value={value}
      onChange={(nextValue) => {
        const params = new URLSearchParams({ ...baseParams, status: nextValue, page: "1" });
        for (const [key, paramValue] of params.entries()) {
          if (!paramValue.trim()) params.delete(key);
        }
        if (nextValue === "all") params.delete("status");
        router.push(`/admin/products?${params.toString()}`);
      }}
      options={[
        { value: "all", label: "Todos", count: counts.all },
        { value: "active", label: "Activos", count: counts.active },
        { value: "inactive", label: "Inactivos", count: counts.inactive },
        { value: "oos", label: "Sin stock", count: counts.oos },
        { value: "low", label: "Stock bajo", count: counts.low },
        { value: "variants", label: "Con variantes", count: counts.variants },
      ]}
    />
  );
}

function isStatusFilter(value: string): value is StatusFilter {
  return ["all", "active", "inactive", "oos", "low", "variants"].includes(value);
}
