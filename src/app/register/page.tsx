"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/checkout";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Crear cuenta</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Creá tu cuenta para finalizar la compra.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);

            const r = await fetch("/api/register", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, email, password }),
            });

            const data = await r.json().catch(() => ({}));

            if (!r.ok) {
              setLoading(false);
              setError(data?.error || "No se pudo crear la cuenta.");
              return;
            }

            // Auto-login luego de registrarse
            const res = await signIn("credentials", {
              email,
              password,
              redirect: false,
            });

            setLoading(false);

            if (!res || res.error) {
              router.push(`/login?next=${encodeURIComponent(next)}`);
              return;
            }

            router.push(next);
          }}
        >
          <div>
            <label className="text-sm text-zinc-300">Nombre (opcional)</label>
            <input
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-300">Email</label>
            <input
              type="email"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="text-sm text-zinc-300">Contraseña</label>
            <input
              type="password"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <p className="mt-2 text-xs text-zinc-500">Mínimo 6 caracteres.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-900/40 bg-red-900/20 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-400">
          ¿Ya tenés cuenta?{" "}
          <Link
            className="text-zinc-200 hover:underline"
            href={`/login?next=${encodeURIComponent(next)}`}
          >
            Iniciar sesión
          </Link>
        </div>

        <div className="mt-6">
          <Link href="/cart" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Volver al carrito
          </Link>
        </div>
      </div>
    </main>
  );
}
