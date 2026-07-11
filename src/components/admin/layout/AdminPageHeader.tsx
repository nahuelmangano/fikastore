import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type AdminPageHeaderProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export default function AdminPageHeader({
  title,
  subtitle,
  eyebrow,
  backHref,
  backLabel = "Volver",
  actions,
}: AdminPageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between xl:gap-3">
      <div>
        {eyebrow ? <p className="text-sm font-medium leading-5 text-[var(--admin-muted-2)] xl:text-xs xl:leading-4">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--admin-text)] xl:mt-1 xl:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-base leading-6 text-[var(--admin-muted)] xl:mt-1 xl:text-sm xl:leading-5">{subtitle}</p> : null}
      </div>

      {(backHref || actions) ? (
        <div className="flex flex-wrap gap-2 xl:gap-1.5">
          {backHref ? (
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-white/70 px-4 py-2.5 text-sm font-semibold text-[var(--admin-primary)] shadow-sm transition duration-150 hover:bg-[var(--admin-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/30 xl:px-3.5 xl:py-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel}
            </Link>
          ) : null}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
