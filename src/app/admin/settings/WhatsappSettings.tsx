"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEFAULT_WHATSAPP_MESSAGE, WHATSAPP_MESSAGE_MAX_LENGTH, formatWhatsappMessage } from "@/lib/whatsapp";

export default function WhatsappSettings({ initialMessage }: { initialMessage: string }) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function save() {
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/admin/settings/whatsapp", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo guardar el mensaje.");
      setNotice("Mensaje guardado.");
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "No se pudo guardar el mensaje. Intentá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 text-sm text-[#5F3B18]">
      <label htmlFor="whatsapp-message" className="block font-semibold">Mensaje precargado</label>
      <p id="whatsapp-help" className="leading-6 text-[#9A6030]">
        Se usa al hacer clic en el teléfono del cliente dentro de un pedido. Usá <code>{"{nombre}"}</code> para el nombre del cliente y <code>{"{pedido}"}</code> para el número de pedido. Dejalo vacío para abrir el chat sin mensaje.
      </p>
      <textarea
        id="whatsapp-message"
        aria-describedby="whatsapp-help"
        value={message}
        onChange={(event) => { setMessage(event.target.value); setNotice(""); }}
        disabled={loading}
        maxLength={WHATSAPP_MESSAGE_MAX_LENGTH}
        rows={6}
        className="w-full rounded-2xl border border-[#E8D5C4] bg-white p-4 outline-none focus:border-[#8B572A]"
      />
      <p className="text-xs text-[#9A6030]">{message.length}/{WHATSAPP_MESSAGE_MAX_LENGTH} caracteres</p>
      <div className="rounded-2xl border border-[#E8D5C4] bg-[#FAF8F5] p-4">
        <p className="mb-2 font-semibold">Vista previa (cliente y pedido de ejemplo)</p>
        <p className="whitespace-pre-wrap break-words">{formatWhatsappMessage(message, "Paula Alvarez", 2142) || "Sin mensaje precargado."}</p>
      </div>
      <p className="text-xs text-[#9A6030]">Podés editar el texto en WhatsApp antes de enviarlo. No se envía automáticamente.</p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={loading} className="rounded-full bg-[#8B572A] px-5 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "Guardando…" : "Guardar mensaje"}
        </button>
        <button type="button" disabled={loading} onClick={() => { setMessage(DEFAULT_WHATSAPP_MESSAGE); setNotice("Mensaje predeterminado cargado. Guardá para aplicar el cambio."); }} className="rounded-full border border-[#E8D5C4] px-5 py-2 disabled:opacity-50">
          Usar mensaje predeterminado
        </button>
      </div>
      <p role="status" aria-live="polite">{notice}</p>
    </div>
  );
}
