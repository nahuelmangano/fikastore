"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { correoSelectionDisabledReason, importCorreoSelection, type CorreoBulkResult, type CorreoSelectableOrder } from "@/lib/correoBulkImport";

type SelectionContextValue = {
  orders: CorreoSelectableOrder[];
  selected: Set<string>;
  busy: boolean;
  toggle: (ids: string[], checked: boolean) => void;
};

const SelectionContext = createContext<SelectionContextValue | null>(null);

export default function OrderBulkSelection({ orders, archived, children }: { orders: CorreoSelectableOrder[]; archived: boolean; children: ReactNode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"import" | "archive" | null>(null);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState(false);
  const running = useRef(false);
  const [results, setResults] = useState<CorreoBulkResult[]>([]);
  const [total, setTotal] = useState(0);
  const selectedOrders = orders.filter((order) => selected.has(order.id));
  const importableOrders = selectedOrders.filter((order) => !correoSelectionDisabledReason(order));

  function toggle(ids: string[], checked: boolean) {
    if (running.current) return;
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function importSelected() {
    if (running.current || !importableOrders.length) return;
    running.current = true;
    setBusy(true);
    setAction("import");
    setArchiveMessage(null);
    setResults([]);
    setTotal(importableOrders.length);
    try {
      await importCorreoSelection(importableOrders, (result) => {
        setResults((previous) => [...previous, result]);
        if (result.ok) setSelected((previous) => {
          const next = new Set(previous);
          next.delete(result.id);
          return next;
        });
      });
    } finally {
      running.current = false;
      setBusy(false);
      router.refresh();
    }
  }

  async function archiveSelected() {
    if (running.current || !selectedOrders.length) return;
    running.current = true;
    setBusy(true);
    setAction("archive");
    setResults([]);
    setArchiveMessage(null);
    setArchiveError(false);
    try {
      const response = await fetch("/api/admin/orders/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: selectedOrders.map((order) => order.id), archived: !archived }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || "No se pudieron actualizar los pedidos.");
      setArchiveMessage(`${data.count} pedidos ${archived ? "restaurados" : "archivados"}.`);
      setSelected(new Set());
      router.refresh();
    } catch (error) {
      setArchiveError(true);
      setArchiveMessage(error instanceof Error ? error.message : "No se pudieron actualizar los pedidos.");
    } finally {
      running.current = false;
      setBusy(false);
    }
  }

  return (
    <SelectionContext.Provider value={{ orders, selected, busy, toggle }}>
      {orders.length > 0 || archiveMessage || results.length > 0 ? (
        <div className="mt-6 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-[var(--admin-text-soft)]">
              <OrderSelectionCheckbox />
              Seleccionar todos en esta página
            </label>
            <span className="text-sm text-[var(--admin-muted)]">{selectedOrders.length} seleccionados</span>
            <button type="button" onClick={importSelected} disabled={busy || !importableOrders.length} className="rounded-xl bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {busy && action === "import" ? `Importando ${results.length}/${total}…` : `Importar selección a Correo Argentino${selectedOrders.length ? ` (${importableOrders.length})` : ""}`}
            </button>
            <button type="button" onClick={archiveSelected} disabled={busy || !selectedOrders.length} className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] disabled:opacity-50">
              {busy && action === "archive" ? (archived ? "Restaurando…" : "Archivando…") : (archived ? "Restaurar selección" : "Archivar selección")}
            </button>
            {selectedOrders.length > 0 ? <button type="button" disabled={busy} onClick={() => toggle([...selected], false)} className="text-sm font-medium text-[var(--admin-primary)] disabled:opacity-50">Limpiar selección</button> : null}
          </div>
          <p className="mt-2 text-xs text-[var(--admin-muted)]">Archivar mueve los pedidos a la vista Archivados. Para importar a Correo se procesan únicamente los seleccionados pagados o enviados que todavía no estén importados.</p>
          <div aria-live="polite" aria-atomic="true" className="mt-2 text-sm text-[var(--admin-text-soft)]">
            {busy && action === "import" ? `Procesados ${results.length} de ${total} pedidos.` : results.length > 0 ? `${results.filter((result) => result.ok).length} pedidos importados · ${results.filter((result) => !result.ok).length} con error.` : null}
            {archiveMessage ? <span className={archiveError ? "text-red-700" : "text-emerald-700"}>{archiveMessage}</span> : null}
          </div>
          {results.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm">
              {results.map((result) => <li key={result.id} className={result.ok ? "text-emerald-700" : "text-red-700"}>Pedido #{result.orderNumber}: {result.message}</li>)}
            </ul>
          ) : null}
        </div>
      ) : null}
      {children}
    </SelectionContext.Provider>
  );
}

export function OrderSelectionCheckbox({ orderId }: { orderId?: string }) {
  const context = useContext(SelectionContext);
  if (!context) throw new Error("Falta el contexto de selección de pedidos.");
  const { orders, selected, busy, toggle } = context;
  const order = orderId ? orders.find((item) => item.id === orderId) : undefined;
  const ids = orderId ? [orderId] : orders.map((item) => item.id);
  const checked = ids.length > 0 && ids.every((id) => selected.has(id));
  const mixed = !orderId && !checked && ids.some((id) => selected.has(id));
  const label = order ? `Seleccionar pedido #${order.orderNumber}` : "Seleccionar todos los pedidos en esta página";
  return <input type="checkbox" aria-label={label} title={label} checked={checked} ref={(element) => { if (element) element.indeterminate = mixed; }} disabled={busy || ids.length === 0} onChange={(event) => toggle(ids, event.target.checked)} className="h-4 w-4 cursor-pointer accent-[var(--admin-primary)] disabled:cursor-not-allowed disabled:opacity-40" />;
}
