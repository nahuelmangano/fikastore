"use client";

import { Search, X } from "lucide-react";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  debounceMs?: number;
  onClear?: () => void;
};

export default function SearchBar({
  value,
  onChange,
  placeholder = "Buscar...",
  ariaLabel = "Buscar",
  disabled = false,
  onClear,
}: SearchBarProps) {
  return (
    <div className="relative w-full lg:max-w-md">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-muted-2)]" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className="w-full rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] py-3 pl-11 pr-11 text-sm text-[var(--admin-text)] outline-none transition duration-150 placeholder:text-[var(--admin-muted-2)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/15 disabled:cursor-not-allowed disabled:opacity-60 xl:py-2.5"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="absolute right-3 top-1/2 rounded-lg p-1 text-[var(--admin-muted)] transition duration-150 hover:bg-[var(--admin-surface-muted)] hover:text-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          aria-label="Limpiar búsqueda"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
