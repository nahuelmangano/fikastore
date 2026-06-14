"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS = [
  { value: "newest", label: "Mas nuevo a mas viejo" },
  { value: "price_asc", label: "Menor precio" },
  { value: "price_desc", label: "Mayor precio" },
  { value: "stock_desc", label: "Mayor stock" },
];

export default function ProductSortSelect({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <select
      value={value}
      onChange={(event) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("sort", event.target.value);
        params.delete("page");
        router.push(`/products?${params.toString()}`);
      }}
      className="h-11 max-w-full border border-zinc-300 bg-white px-3 text-sm text-zinc-700 outline-none focus:border-black"
      aria-label="Ordenar productos"
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
