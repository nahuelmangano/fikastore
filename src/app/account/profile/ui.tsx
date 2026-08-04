"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useSession } from "next-auth/react";

export default function ProfileForm({
  initialName,
  email,
  initialBirthDate,
}: {
  initialName: string;
  email: string;
  initialBirthDate: string;
}) {
  const { update } = useSession();
  const [name, setName] = useState(initialName);
  const [birthDate, setBirthDate] = useState(initialBirthDate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, birthDate }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);

    if (!res.ok) {
      setError(data?.error || "No se pudieron guardar los cambios.");
      return;
    }

    setName(data.user?.name || "");
    setBirthDate(data.user?.birthDate || "");
    await update({ name: data.user?.name || undefined });
    setMessage("Datos guardados.");
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
      <div className="grid gap-5">
        <div>
          <label className="text-sm text-zinc-300">Email</label>
          <input
            value={email}
            disabled
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-500"
          />
          <p className="mt-2 text-xs text-zinc-500">El email no se puede cambiar desde esta sección.</p>
        </div>

        <div>
          <label className="text-sm text-zinc-300">Nombre</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
            maxLength={100}
          />
        </div>

        <div>
          <label className="text-sm text-zinc-300">Fecha de nacimiento</label>
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            autoComplete="bday"
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2"
          />
          <p className="mt-2 text-xs text-zinc-500">La usamos para enviarte beneficios de cumpleaños.</p>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </div>
      )}
      {message && (
        <div className="mt-5 rounded-xl border border-emerald-800/50 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          {message}
        </div>
      )}

      <button
        disabled={saving}
        className="mt-6 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
