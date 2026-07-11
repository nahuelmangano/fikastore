type LoadingStateProps = {
  text?: string;
  rows?: number;
};

export default function LoadingState({ text = "Cargando...", rows = 3 }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-sm text-[var(--admin-muted)]">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--admin-border)] border-t-[var(--admin-primary)]" />
        {text}
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-10 animate-pulse rounded-2xl bg-[var(--admin-surface-muted)]" />
        ))}
      </div>
    </div>
  );
}
