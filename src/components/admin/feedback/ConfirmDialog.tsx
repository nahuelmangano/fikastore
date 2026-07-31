"use client";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  variant = "default",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Cerrar diálogo" className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="relative w-full max-w-md rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-background)] p-5 shadow-2xl">
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-[var(--admin-text)]">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-[var(--admin-muted)]">{description}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-2xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={[
              "rounded-2xl px-4 py-2 text-sm font-semibold text-white transition duration-150 disabled:opacity-60",
              variant === "danger" ? "bg-red-700 hover:bg-red-800" : "bg-[var(--admin-primary)] hover:bg-[var(--admin-primary-hover)]",
            ].join(" ")}
          >
            {loading ? "Procesando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
