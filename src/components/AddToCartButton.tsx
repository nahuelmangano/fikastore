"use client";

import { useState } from "react";
import { addToCart } from "@/lib/cart";

type Props = {
  product: {
    id: string;
    slug: string;
    name: string;
    price: number;
    stock: number;
    imageUrl?: string;
  };
};

export default function AddToCartButton({ product }: Props) {
  const [added, setAdded] = useState(false);

  const disabled = product.stock <= 0;

  return (
    <button
      disabled={disabled}
      onClick={() => {
        addToCart(
          {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            price: product.price,
            stock: product.stock,
            imageUrl: product.imageUrl,
          },
          1
        );
        window.dispatchEvent(new Event("cart:open"));
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      className="mt-6 w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
    >
      {disabled ? "Sin stock" : added ? "Agregado ✅" : "Agregar al carrito"}
    </button>
  );
}
