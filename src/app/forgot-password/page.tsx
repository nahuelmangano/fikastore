"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">¿Olvidaste tu contraseña?</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Ingresá tu email y te enviaremos un enlace para crear una nueva contraseña.
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setLoading(true);
            setError(null);
            setMessage(null);

            const res = await fetch("/api/auth/forgot-password", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email }),
            });
            const data = await res.json().catch(() => ({}));

            setLoading(false);

            if (!res.ok) {
              setError(data?.error || "No se pudo enviar el email.");
              return;
            }

            setMessage(data?.message || "Si existe una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.");
          }}
        >
          <div>
            <label className="text-sm text-zinc-300">Email</label>
            <input
              type="email"
              className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-emerald-700/40 bg-emerald-50 p-3 text-sm text-emerald-900">
              {message}
            </div>
          ) : null}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar enlace"}
          </button>
        </form>

        <div className="mt-6">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Volver al login
          </Link>
        </div>
      </div>
    </main>
  );
}
