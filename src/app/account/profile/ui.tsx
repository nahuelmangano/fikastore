"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Eye, EyeOff } from "lucide-react";

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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  async function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChangingPassword(true);
    setPasswordMessage(null);
    setPasswordError(null);

    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setChangingPassword(false);

    if (!res.ok) {
      setPasswordError(data?.error || "No se pudo cambiar la contraseña.");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Contraseña actualizada.");
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <div className="grid gap-5">
          <div>
            <label className="text-sm text-zinc-300">Email</label>
            <input value={email} disabled className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-500" />
            <p className="mt-2 text-xs text-zinc-500">El email no se puede cambiar desde esta sección.</p>
          </div>

          <div>
            <label className="text-sm text-zinc-300">Nombre</label>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" maxLength={100} />
          </div>

          <div>
            <label className="text-sm text-zinc-300">Fecha de nacimiento</label>
            <input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} autoComplete="bday" className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2" />
            <p className="mt-2 text-xs text-zinc-500">La usamos para enviarte beneficios de cumpleaños.</p>
          </div>
        </div>

        {error && <div className="mt-5 rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">{error}</div>}
        {message && <div className="mt-5 rounded-xl border border-emerald-800/50 bg-emerald-950/40 p-3 text-sm text-emerald-200">{message}</div>}

        <button disabled={saving} className="mt-6 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50">
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      <details className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
        <summary className="cursor-pointer text-lg font-semibold">Cambiar contraseña</summary>
        <form onSubmit={onPasswordSubmit} className="mt-5">
          <div className="grid gap-5">
          <div>
            <label className="text-sm text-zinc-300">Contraseña actual</label>
            <div className="relative mt-2">
              <input type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 pr-11" />
              <button type="button" onClick={() => setShowCurrentPassword((value) => !value)} aria-label={showCurrentPassword ? "Ocultar contraseña actual" : "Mostrar contraseña actual"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:text-zinc-100">
                {showCurrentPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-300">Nueva contraseña</label>
            <div className="relative mt-2">
              <input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={6} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 pr-11" />
              <button type="button" onClick={() => setShowNewPassword((value) => !value)} aria-label={showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:text-zinc-100">
                {showNewPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm text-zinc-300">Repetir nueva contraseña</label>
            <div className="relative mt-2">
              <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={6} className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 pr-11" />
              <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} aria-label={showConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 hover:text-zinc-100">
                {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
          </div>

          {passwordError && <div className="mt-5 rounded-xl border border-amber-700/40 bg-amber-50 p-3 text-sm text-amber-900">{passwordError}</div>}
          {passwordMessage && <div className="mt-5 rounded-xl border border-emerald-800/50 bg-emerald-950/40 p-3 text-sm text-emerald-200">{passwordMessage}</div>}

          <button disabled={changingPassword} className="mt-6 rounded-2xl bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-900 hover:bg-white disabled:opacity-50">
            {changingPassword ? "Actualizando..." : "Cambiar contraseña"}
          </button>
        </form>
      </details>
    </div>
  );
}
