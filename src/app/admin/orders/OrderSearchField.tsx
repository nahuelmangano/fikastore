"use client";

import { useState } from "react";
import SearchBar from "@/components/admin/data/SearchBar";

export default function OrderSearchField({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue);

  return (
    <>
      <SearchBar
        value={value}
        onChange={setValue}
        placeholder="Buscar por pedido, cliente o email..."
        ariaLabel="Buscar pedidos por número, cliente, email o id"
      />
      <input type="hidden" name="q" value={value} />
    </>
  );
}
