"use client";

import { useState } from "react";

type CategoryOption = {
  id: string;
  name: string;
};

function selectedProductIds() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="bulkProductIds"]:checked')).flatMap(
    (input) => input.value.split(",").map((id) => id.trim()).filter(Boolean)
  );
}

export default function BulkCategoryToolbar({ categories }: { categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function selectVisible(checked: boolean) {
    document.querySelectorAll<HTMLInputElement>('input[name="bulkProductIds"]').forEach((input) => {
      input.checked = checked;
    });
    setMsg(null);
  }

  async function applyCategory() {
    setMsg(null);
    const productIds = selectedProductIds();
    if (productIds.length === 0) {
      setMsg("Marca productos en la columna Sel. o usa Seleccionar pagina.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/admin/products/bulk-category", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds, categoryId }),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setMsg(String(data?.error || "No se pudo asignar la categoria."));
      return;
    }

    setMsg(`Categoria actualizada en ${data.updated ?? productIds.length} producto(s).`);
    window.location.reload();
  }

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-zinc-900/40"
        aria-expanded={open}
      >
        <span>Asignar categoria a productos marcados</span>
        <span className="text-lg leading-none text-zinc-400">{open ? "-" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-zinc-800 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-zinc-400">Nueva categoria</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-2 min-w-64 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
              >
                <option value="">Sin categoria</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={applyCategory}
              disabled={loading}
              className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Aplicando..." : "Aplicar"}
            </button>

            <button
              type="button"
              onClick={() => selectVisible(true)}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              Seleccionar pagina
            </button>

            <button
              type="button"
              onClick={() => selectVisible(false)}
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
            >
              Limpiar seleccion
            </button>
          </div>

          {msg && <div className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 text-sm">{msg}</div>}
        </div>
      )}
    </div>
  );
}
