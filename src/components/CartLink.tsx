"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { cartCount, readCart } from "@/lib/cart";
import CartPanel from "@/components/CartPanel";

export default function CartLink({
  variant = "default",
  searchSlot,
  compact = false,
}: {
  variant?: "default" | "store";
  searchSlot?: ReactNode;
  compact?: boolean;
}) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const { data: session } = useSession();
  const isMerchant = session?.user?.role === "merchant";
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

  const isStore = variant === "store";
  const buttonClass = isStore
    ? "flex items-center gap-3 text-sm font-normal uppercase leading-none text-black hover:text-zinc-600"
    : "rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60";
  const menuClass = isStore
    ? "absolute right-0 top-full z-50 mt-8 w-56 border border-zinc-200 bg-white p-2 text-sm text-black shadow-xl"
    : "absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-200 shadow-lg";
  const menuItemClass = isStore
    ? "block w-full px-3 py-2 text-left text-sm uppercase text-black hover:bg-zinc-50"
    : "block rounded-lg px-2 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-900/60";

  return (
    <div className={compact ? "flex items-center gap-4" : "flex items-center gap-8"}>
      <div className={compact ? "relative hidden" : "relative"} ref={menuRef}>
        {session?.user?.email ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={buttonClass}
          >
            Cuenta
            {isStore && <span className="mt-[-3px] h-2 w-2 rotate-45 border-b border-r border-black" />}
          </button>
        ) : (
          <Link
            href="/login"
            className={buttonClass}
          >
            Cuenta
            {isStore && <span className="mt-[-3px] h-2 w-2 rotate-45 border-b border-r border-black" />}
          </Link>
        )}

        {open && session?.user?.email && (
          <div className={menuClass}>
            <div className={isStore ? "px-3 py-2 text-xs uppercase text-zinc-500" : "px-2 py-2 text-xs text-zinc-400"}>Sesión</div>
            <div className={isStore ? "px-3 pb-2 text-sm text-zinc-700" : "px-2 pb-2 text-sm text-zinc-100"}>
              {session?.user?.email || "No logueado"}
            </div>
            <Link
              href="/account/orders"
              className={menuItemClass}
              onClick={() => setOpen(false)}
            >
              Mis pedidos
            </Link>
            {isMerchant && (
              <Link
                href="/admin"
                className={menuItemClass}
                onClick={() => setOpen(false)}
              >
                Admin de tienda
              </Link>
            )}

            {session?.user?.email ? (
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className={menuItemClass}
              >
                Cerrar sesión
              </button>
            ) : (
              <Link
                href="/login"
                className={menuItemClass}
              >
                Iniciar sesión
              </Link>
            )}
          </div>
        )}
      </div>

      {isStore && !compact && (
        <>
          <Link href="/register" className="text-sm font-normal uppercase leading-none text-black hover:text-zinc-600">
            Contacto
          </Link>
          {searchSlot}
        </>
      )}

      {isStore && compact && searchSlot}

      <button
        type="button"
        onClick={() => setCartOpen(true)}
        className={isStore ? "relative flex items-center gap-1 text-sm font-normal uppercase leading-none text-black hover:text-zinc-600" : "relative rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"}
        aria-label="Abrir carrito"
      >
        {isStore ? (
          <svg aria-hidden="true" className="h-[19px] w-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="21" r="1" />
            <circle cx="19" cy="21" r="1" />
            <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
          </svg>
        ) : "Carrito"}
        {(isStore || count > 0) && (
          <span className={isStore ? "text-sm font-normal text-black" : "ml-2 inline-flex min-w-6 justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-900"}>
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
