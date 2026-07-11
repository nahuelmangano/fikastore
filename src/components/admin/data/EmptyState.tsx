import type { ComponentType, ReactNode, SVGProps } from "react";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

type EmptyStateProps = {
  icon?: IconType;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
};

export default function EmptyState({ icon: Icon, title, description, action, secondaryAction }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-background)] px-5 py-12 text-center xl:py-8">
      {Icon ? (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--admin-primary)] shadow-sm xl:h-11 xl:w-11">
          <Icon className="h-6 w-6 xl:h-5 xl:w-5" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className={Icon ? "mt-4 font-semibold text-[var(--admin-text)] xl:mt-3" : "font-semibold text-[var(--admin-text)]"}>{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-[var(--admin-muted)]">{description}</p> : null}
      {(action || secondaryAction) ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2 xl:mt-4">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
