import type { ReactNode } from "react";

type SectionCardProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
};

export default function SectionCard({ title, description, actions, children, className = "", noPadding = false }: SectionCardProps) {
  return (
    <section className={["rounded-3xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow)]", noPadding ? "" : "p-5 xl:p-4", className].join(" ")}>
      {(title || description || actions) ? (
        <div className={["flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between xl:gap-2", noPadding ? "p-5 xl:p-4" : "mb-5 xl:mb-3"].join(" ")}>
          <div>
            {title ? <h2 className="text-lg font-semibold leading-6 text-[var(--admin-text)] xl:text-base xl:leading-5">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)] xl:text-xs xl:leading-4">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
