import type { ReactNode } from "react";

type AdminSectionProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function AdminSection({ title, description, actions, children }: AdminSectionProps) {
  return (
    <section className="mt-8">
      {(title || description || actions) ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="text-lg font-semibold text-[var(--admin-text)]">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[var(--admin-muted)]">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
