"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { readCart } from "@/lib/cart";

export default function CartSync() {
  const { data: session } = useSession();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    const send = () => {
      const items = readCart().map((it) => ({
        productId: it.productId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
      }));

      fetch("/api/cart/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      }).catch(() => null);
    };

    const schedule = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(send, 800);
    };

    schedule();

    const onChange = () => schedule();
    window.addEventListener("cart:changed", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("cart:changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [session?.user]);

  return null;
}
