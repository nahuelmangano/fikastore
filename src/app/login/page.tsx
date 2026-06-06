"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { getSession, signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-950 text-zinc-100" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/checkout";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Para pagar necesitás tener una cuenta.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);

            const res = await signIn("credentials", {
              email,
              password,
              redirect: false,
            });

            setLoading(false);

            if (!res || res.error) {
              setError("Email o contraseña incorrectos.");
              return;
            }

            const session = await getSession();
            const role = (session?.user as { role?: string } | undefined)?.role;
            const destination = role === "admin" || role === "merchant" ? "/admin" : "/";
            router.push(destination);
          }}
        >
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
              autoComplete="current-password"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>

        <div className="mt-6 text-sm text-zinc-400">
          ¿No tenés cuenta?{" "}
          <Link
            className="text-zinc-200 hover:underline"
            href={`/register?next=${encodeURIComponent(next)}`}
          >
            Crear cuenta
          </Link>
        </div>

        <div className="mt-6">
          <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Volver a la tienda
          </Link>
        </div>
      </div>
    </main>
  );
}
