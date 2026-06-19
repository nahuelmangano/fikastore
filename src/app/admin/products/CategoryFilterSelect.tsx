"use client";

import { useEffect, useState } from "react";

type CategoryOption = {
  id: string;
  name: string;
  slug: string;
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
      className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
    >
      <option value="all">Todas</option>
      <option value="uncategorized">Sin categoria</option>
      {categories.map((item) => (
        <option key={item.id} value={item.slug}>
          {item.name}
        </option>
      ))}
    </select>
  );
}
