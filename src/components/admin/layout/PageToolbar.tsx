import type { ReactNode } from "react";

type PageToolbarProps = {
  title?: string;
  description?: string;
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
};

export default function PageToolbar({ title, description, search, filters, actions }: PageToolbarProps) {
  return (
    <div className="flex flex-col gap-4 xl:gap-3">
      {(title || description || search || actions) ? (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between xl:gap-3">
          {(title || description) ? (
            <div>
              {title ? <h2 className="text-lg font-semibold leading-6 text-[var(--admin-text)] xl:text-base xl:leading-5">{title}</h2> : null}
              {description ? <p className="mt-1 text-sm leading-5 text-[var(--admin-muted)] xl:text-xs xl:leading-4">{description}</p> : null}
            </div>
          ) : null}
          {(search || actions) ? (
            <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto lg:items-center xl:gap-1.5">
              {search}
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {filters}
    </div>
  );
}
