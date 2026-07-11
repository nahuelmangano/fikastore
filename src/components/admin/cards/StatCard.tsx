import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type StatCardProps = {
  title: string;
  value: ReactNode;
  description?: string;
  icon?: IconType;
  trend?: ReactNode;
  loading?: boolean;
  href?: string;
  variant?: "default" | "featured";
};

export default function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  loading = false,
  href,
}: StatCardProps) {
  const content = (
    <div
      className={[
        "rounded-3xl border p-5 shadow-[var(--admin-shadow)] transition duration-150 xl:p-4",
        "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-soft)]",
        href ? "hover:-translate-y-0.5 hover:shadow-lg" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4 xl:gap-3">
        <div>
          <div className="text-sm font-medium leading-5 text-[var(--admin-muted-2)] xl:text-xs xl:leading-4">
            {title}
          </div>
          {loading ? (
            <div className="mt-3 h-9 w-24 rounded-xl bg-[var(--admin-surface-muted)] xl:mt-2 xl:h-7" />
          ) : (
            <div className="mt-3 text-3xl font-semibold tracking-tight xl:mt-2 xl:text-2xl">{value}</div>
          )}
          {description ? (
            <div className="mt-2 text-sm leading-5 text-[var(--admin-muted)] xl:mt-1 xl:text-xs xl:leading-4">{description}</div>
          ) : null}
          {trend ? <div className="mt-3 text-sm xl:mt-2 xl:text-xs">{trend}</div> : null}
        </div>
        {Icon ? (
          <div className="rounded-2xl bg-[var(--admin-surface-muted)] p-3 text-[var(--admin-primary)] xl:p-2.5">
            <Icon className="h-5 w-5 xl:h-4 xl:w-4" aria-hidden="true" />
          </div>
        ) : null}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
