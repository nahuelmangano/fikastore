"use client";

type FilterOption<T extends string> = {
  value: T;
  label: string;
  count?: number;
};

type FilterChipsProps<T extends string> = {
  options: FilterOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
};

export default function FilterChips<T extends string>({ options, value, onChange, ariaLabel = "Filtros" }: FilterChipsProps<T>) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 xl:gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={[
              "shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold transition duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 xl:px-3 xl:py-1.5 xl:text-xs",
              active
                ? "bg-[var(--admin-primary)] text-white shadow-sm"
                : "border border-[var(--admin-border)] text-[#7B522E] hover:bg-[var(--admin-surface-muted)]",
            ].join(" ")}
          >
            {option.label}
            {typeof option.count === "number" ? (
              <span className={active ? "ml-2 text-white/75" : "ml-2 text-[var(--admin-muted)]"}>{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
