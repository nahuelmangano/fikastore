"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cartCount, readCart } from "@/lib/cart";

export default function CartLink() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sync = () => setCount(cartCount(readCart()));
    sync();

    const onChange = () => sync();
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return (
    <Link
      href="/cart"
      className="relative rounded-xl border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-900/60"
    >
      Carrito
      {count > 0 && (
        <span className="ml-2 inline-flex min-w-6 justify-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-900">
          {count}
        </span>
      )}
    </Link>
  );
}
