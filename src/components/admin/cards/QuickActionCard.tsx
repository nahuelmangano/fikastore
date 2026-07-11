import Link from "next/link";
import type { ComponentType, MouseEventHandler, SVGProps } from "react";
import { ArrowRight } from "lucide-react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type QuickActionCardProps = {
  title: string;
  description?: string;
  icon?: IconType;
  href?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

export default function QuickActionCard({ title, description, icon: Icon, href, onClick, disabled = false }: QuickActionCardProps) {
  const className = "group flex w-full items-center justify-between gap-3 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-background)] px-4 py-4 text-left text-sm font-semibold text-[var(--admin-text-soft)] transition duration-150 hover:translate-x-1 hover:bg-[var(--admin-surface-muted)] disabled:cursor-not-allowed disabled:opacity-60 xl:gap-2 xl:py-3";
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        {Icon ? (
          <span className="rounded-xl bg-white p-2 text-[var(--admin-primary)] shadow-sm xl:p-1.5">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block truncate">{title}</span>
          {description ? <span className="mt-1 block truncate text-xs font-normal text-[var(--admin-muted)] xl:mt-0.5">{description}</span> : null}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--admin-muted-2)] transition duration-150 group-hover:text-[var(--admin-primary)]" aria-hidden="true" />
    </>
  );

  if (href && !disabled) {
    return <Link href={href} className={className}>{content}</Link>;
  }

  return <button type="button" onClick={onClick} disabled={disabled} className={className}>{content}</button>;
}
