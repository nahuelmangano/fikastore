"use client";

import { useEffect, useState } from "react";

type CategoryOption = {
  id: string;
  parentId?: string | null;
  name: string;
  slug: string;
  label?: string;
};

export default function CategoryFilterSelect({
  categories,
  value,
}: {
  categories: CategoryOption[];
  value: string;
}) {
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  return (
    <select
      name="category"
      value={selected}
      onChange={(event) => {
        setSelected(event.currentTarget.value);
        event.currentTarget.form?.requestSubmit();
      }}
      className="mt-2 w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-4 py-3 xl:py-2.5 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15"
    >
      <option value="all">Todas</option>
      <option value="uncategorized">Sin categoría</option>
      {categories.map((item) => (
        <option key={item.id} value={item.slug}>
          {item.label ?? item.name}
        </option>
      ))}
    </select>
  );
}
