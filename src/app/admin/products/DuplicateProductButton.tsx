"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function DuplicateProductButton({ productId, returnHref }: { productId: string; returnHref: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function duplicateProduct() {
    setLoading(true);

    const res = await fetch(`/api/admin/products/${productId}/duplicate`, {
      method: "POST",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      alert(String(data?.error || "No se pudo duplicar el producto."));
      return;
    }

    const nextId = String(data?.product?.id || "");
    if (nextId) {
      router.push(`/admin/products/${nextId}?${new URLSearchParams({ returnTo: returnHref }).toString()}`);
      router.refresh();
      return;
    }

    setLoading(false);
    alert("Producto duplicado, pero no se pudo abrir el editor.");
  }

  return (
    <button
      type="button"
      onClick={duplicateProduct}
      disabled={loading}
      className="rounded-xl border border-[var(--admin-border)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-primary)] transition duration-150 hover:bg-[var(--admin-surface-muted)] disabled:opacity-50"
    >
      {loading ? "Duplicando..." : "Duplicar"}
    </button>
  );
}
