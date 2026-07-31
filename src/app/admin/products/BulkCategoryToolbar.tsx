"use client";

import { useEffect, useState } from "react";

type CategoryOption = {
  id: string;
  parentId?: string | null;
  name: string;
  label?: string;
};

function selectedProductIds() {
  return Array.from(document.querySelectorAll<HTMLInputElement>('input[name="bulkProductIds"]:checked')).flatMap(
    (input) => input.value.split(",").map((id) => id.trim()).filter(Boolean)
  );
}

export default function BulkCategoryToolbar({ categories }: { categories: CategoryOption[] }) {
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  useEffect(() => {
    function updateSelectedCount() {
      setSelectedCount(selectedProductIds().length);
    }

    updateSelectedCount();
    document.addEventListener("change", updateSelectedCount);
    document.addEventListener("bulk-products-change", updateSelectedCount);
    return () => {
      document.removeEventListener("change", updateSelectedCount);
      document.removeEventListener("bulk-products-change", updateSelectedCount);
    };
  }, []);

  function selectVisible(checked: boolean) {
    document.querySelectorAll<HTMLInputElement>('input[name="bulkProductIds"]').forEach((input) => {
      input.checked = checked;
    });
    setMsg(null);
    document.dispatchEvent(new Event("bulk-products-change"));
  }

  async function applyCategory() {
    setMsg(null);
    const productIds = selectedProductIds();
    if (productIds.length === 0) {
      setMsg("Marcá productos en la tabla para asignarles una categoría.");
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
      setMsg(String(data?.error || "No se pudo asignar la categoría."));
      return;
    }

    setMsg(`Categoría actualizada en ${data.updated ?? productIds.length} producto(s).`);
    window.location.reload();
  }

  if (selectedCount === 0) return null;

  return (
    <div className="mt-6 xl:mt-4 rounded-3xl border border-[var(--admin-primary)]/35 bg-[#F6F0EA] p-4 shadow-[var(--admin-shadow)]">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-sm font-semibold text-[var(--admin-text)]">
            {selectedCount} producto{selectedCount === 1 ? "" : "s"} seleccionado{selectedCount === 1 ? "" : "s"}
          </div>
          <div className="mt-1 text-sm text-[var(--admin-muted)]">Asigná una categoría a los productos marcados.</div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">Nueva categoría</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-2 min-w-64 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-4 py-2.5 xl:py-2 text-sm text-[var(--admin-text)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15"
              >
                <option value="">Sin categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label ?? category.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={applyCategory}
              disabled={loading}
              className="rounded-2xl bg-[var(--admin-primary)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-white transition duration-150 hover:bg-[var(--admin-primary-hover)] disabled:opacity-50"
            >
              {loading ? "Aplicando..." : "Aplicar"}
            </button>

            <button
              type="button"
              onClick={() => selectVisible(false)}
              className="rounded-2xl border border-[var(--admin-border)] px-4 py-2.5 xl:py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)]"
            >
              Cancelar selección
            </button>
          </div>
      </div>

      {msg && <div className="mt-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-3 text-sm text-[var(--admin-text-soft)]">{msg}</div>}
    </div>
  );
}
