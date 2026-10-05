"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-zinc-950 text-zinc-100" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      if (!token) {
        setChecking(false);
        setValidToken(false);
        setError("Falta el enlace de recuperación.");
        return;
      }

      const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));

      if (cancelled) return;

      setChecking(false);
      if (!res.ok) {
        setValidToken(false);
        setError(data?.error || "El enlace no es válido.");
        return;
      }

      setValidToken(true);
      setError(null);
    }

    void validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-2xl font-semibold">Restablecer contraseña</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Elegí una nueva contraseña para tu cuenta.
        </p>

        {checking ? (
          <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-300">
            Verificando enlace…
          </div>
        ) : null}

        {!checking && error ? (
          <div className="mt-8 rounded-xl border border-amber-700/40 bg-amber-50 p-4 text-sm text-amber-900">
            {error}
          </div>
        ) : null}

        {!checking && validToken ? (
          <form
            className="mt-8 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setLoading(true);
              setError(null);
              setMessage(null);

              const res = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, confirmPassword }),
              });
              const data = await res.json().catch(() => ({}));

              setLoading(false);

              if (!res.ok) {
                setError(data?.error || "No se pudo restablecer la contraseña.");
                return;
              }

              setMessage("Tu contraseña fue actualizada. Ya podés iniciar sesión.");
              setValidToken(false);
            }}
          >
            <div>
              <label className="text-sm text-zinc-300">Nueva contraseña</label>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 pr-11"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:text-zinc-100"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-zinc-300">Repetir contraseña</label>
              <div className="relative mt-2">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 pr-11"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  aria-label={showConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:text-zinc-100"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-500">Mínimo 6 caracteres.</p>
            </div>

            {error ? (
              <div className="rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">
                {error}
              </div>
            ) : null}

            <button
              disabled={loading}
              className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
            >
              {loading ? "Actualizando..." : "Guardar nueva contraseña"}
            </button>
          </form>
        ) : null}

        {message ? (
          <div className="mt-6 rounded-xl border border-emerald-700/40 bg-emerald-50 p-4 text-sm text-emerald-900">
            {message}
          </div>
        ) : null}

        <div className="mt-6">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-zinc-200">
            ← Ir al login
          </Link>
        </div>
      </div>
    </main>
  );
}
