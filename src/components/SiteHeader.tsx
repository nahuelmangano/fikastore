import Link from "next/link";
import CartLink from "@/components/CartLink";

export default function SiteHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
          Fika Store
        </Link>
        <CartLink />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight">Fika Store</h1>
      <p className="mt-2 text-zinc-400">
        Pijamas pant, remerones y ropa cómoda para estar en casa ✨
      </p>

      {children}
    </header>
  );
}
