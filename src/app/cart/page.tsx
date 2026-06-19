"use client";

import Link from "next/link";
import CartPanel from "@/components/CartPanel";

export default function CartPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Carrito</h1>
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            Seguir comprando
          </Link>
        </div>

        <div className="mt-8">
          <CartPanel />
        </div>
      </div>
    </main>
  );
}
