"use client";

import Link from "next/link";
import { useState } from "react";

export default function AdminMerchantCreate() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Admin · Alta de merchant</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Este usuario podrá entrar a Productos, Pedidos y Paquetería.
            </p>
          </div>

          <Link href="/admin" className="text-sm text-zinc-400 hover:text-zinc-200">
            Volver
          </Link>
        </div>

        <form
          className="mt-8 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setMsg(null);
            setLoading(true);

            const res = await fetch("/api/admin/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, email, password }),
            });
            const data = await res.json().catch(() => ({}));
            setLoading(false);

            if (!res.ok) {
              setError(data?.error || "No se pudo crear el merchant.");
              return;
            }

            setName("");
            setEmail("");
            setPassword("");
            setMsg(`Merchant creado: ${data?.user?.email ?? ""}`);
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
              minLength={6}
              required
            />
            <p className="mt-2 text-xs text-zinc-500">Mínimo 6 caracteres.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-red-900/40 bg-red-900/20 p-3 text-sm text-red-200">
              {error}
            </div>
          )}
          {msg && (
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-900/20 p-3 text-sm text-emerald-200">
              {msg}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
          >
            {loading ? "Creando..." : "Crear merchant"}
          </button>
        </form>
      </div>
    </main>
  );
}
