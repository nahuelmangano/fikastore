type StatusBadgeProps = {
  label: string;
  variant?: "neutral" | "success" | "warning" | "danger" | "info" | "brand" | "purple";
};

const variantClass = {
  neutral: "border-zinc-200 bg-zinc-50 text-zinc-600",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  danger: "border-red-200 bg-red-50 text-red-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  brand: "border-[var(--admin-border)] bg-[var(--admin-surface-muted)] text-[#7B522E]",
  purple: "border-purple-200 bg-purple-50 text-purple-800",
};

export default function StatusBadge({ label, variant = "neutral" }: StatusBadgeProps) {
  return (
    <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold xl:px-2 xl:py-0.5", variantClass[variant]].join(" ")}>
      {label}
    </span>
  );
}
