import type { ReactNode } from "react";
import LoadingState from "@/components/admin/feedback/LoadingState";

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  emptyState?: ReactNode;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  caption?: string;
};

export default function DataTable<T>({ columns, data, rowKey, emptyState, loading = false, onRowClick, caption }: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--admin-border)] bg-white/45 p-6 xl:p-4">
        <LoadingState text="Cargando datos..." />
      </div>
    );
  }

  if (data.length === 0 && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--admin-border)]">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-[#F6F0EA] text-xs font-semibold uppercase tracking-wide text-[var(--admin-muted-2)]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={["px-4 py-3 xl:py-2.5", column.headerClassName || ""].join(" ")}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)] bg-white/45">
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  "text-sm transition duration-150 hover:bg-[var(--admin-surface-muted)]",
                  onRowClick ? "cursor-pointer" : "",
                ].join(" ")}
              >
                {columns.map((column) => (
                  <td key={column.key} className={["px-4 py-4 xl:py-3", column.className || ""].join(" ")}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
