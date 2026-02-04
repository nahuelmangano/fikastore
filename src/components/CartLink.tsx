"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { cartCount, readCart } from "@/lib/cart";
import CartPanel from "@/components/CartPanel";

export default function CartLink() {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { data: session } = useSession();
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => setCount(cartCount(readCart()));
    sync();

    const onChange = () => sync();
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);
    const onOpen = () => setCartOpen(true);
    window.addEventListener("cart:open", onOpen);

    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("cart:open", onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/account/orders"
        className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
      >
        Mis pedidos
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
        >
          Cuenta
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-200 shadow-lg">
            <div className="px-2 py-2 text-xs text-zinc-400">Sesión</div>
            <div className="px-2 pb-2 text-sm text-zinc-100">
              {session?.user?.email || "No logueado"}
            </div>
            {session?.user?.email ? (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="w-full rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900/60"
              >
                Cerrar sesión
              </button>
            ) : (
              <Link
                href="/login"
                className="block rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900/60"
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className="relative rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
      >
        Carrito
        {count > 0 && (
          <span className="ml-2 inline-flex min-w-6 justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-900">
            {count}
          </span>
        )}
      </button>

      {cartOpen && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            onClick={() => setCartOpen(false)}
            className="cart-overlay absolute inset-0 bg-black/60"
            aria-label="Cerrar carrito"
          />

          <div className="cart-drawer absolute right-0 top-0 h-full w-full max-w-md bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
              <h2 className="text-lg font-semibold">Mi carrito</h2>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className="rounded-lg border border-zinc-800 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900/60"
                aria-label="Cerrar"
              >
                Cerrar
              </button>
            </div>

            <div className="h-[calc(100%-64px)] overflow-y-auto px-5 py-4">
              <CartPanel onClose={() => setCartOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
