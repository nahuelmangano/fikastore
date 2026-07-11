import type { ReactNode } from "react";

type ErrorStateProps = {
  title: string;
  description?: string;
  retryAction?: ReactNode;
  backAction?: ReactNode;
};

export default function ErrorState({ title, description, retryAction, backAction }: ErrorStateProps) {
  return (
    <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-8 text-center text-red-900">
      <h3 className="font-semibold">{title}</h3>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-red-800/80">{description}</p> : null}
      {(retryAction || backAction) ? (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {retryAction}
          {backAction}
        </div>
      ) : null}
    </div>
  );
}
