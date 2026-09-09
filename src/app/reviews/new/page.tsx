import Link from "next/link";
import { validateProductReviewToken } from "@/lib/reviewTokens";

type SearchParams = { token?: string } | Promise<{ token?: string }>;

export default async function NewReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const token = String(resolvedSearchParams?.token || "").trim();
  const result = await validateProductReviewToken(token);

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-12 text-zinc-100">
      <div className="mx-auto max-w-2xl">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-8 shadow-2xl shadow-black/20">
          <h1 className="text-3xl font-semibold tracking-tight">Opinión de compra</h1>

          {!result.ok ? (
            <>
              <p className="mt-3 text-sm text-zinc-400">{result.error}</p>
              <div className="mt-6">
                <Link
                  href="/pedido"
                  className="inline-flex items-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  Ir a consultar mi pedido
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-zinc-400">
                Recibimos tu acceso para dejar una opinión sobre la compra. El formulario público todavía no estaba
                implementado; por eso el enlace terminaba en 404.
              </p>

              <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                <div className="flex items-start gap-4">
                  {result.reviewToken.product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.reviewToken.product.imageUrl}
                      alt={result.reviewToken.product.name}
                      className="h-24 w-20 rounded-xl border border-zinc-800 object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Producto</div>
                    <div className="mt-1 text-lg font-medium text-zinc-100">{result.reviewToken.product.name}</div>
                    <div className="mt-3 text-sm text-zinc-400">
                      Pedido {result.reviewToken.orderNumber ? `#${result.reviewToken.orderNumber}` : result.reviewToken.orderId}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={result.reviewToken.product.slug ? `/products/${result.reviewToken.product.slug}` : "/products"}
                  className="inline-flex items-center rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  Ver producto
                </Link>
                <Link
                  href={
                    result.reviewToken.accessEmail
                      ? `/pedido?orderId=${encodeURIComponent(result.reviewToken.orderId)}&email=${encodeURIComponent(result.reviewToken.accessEmail)}`
                      : "/pedido"
                  }
                  className="inline-flex items-center rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
                >
                  Ver pedido
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
