"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { X } from "lucide-react";

export default function RegretButtonModal() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    orderNumber: "",
    comments: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || form.name),
      email: String(formData.get("email") || form.email),
      phone: String(formData.get("phone") || form.phone),
      orderNumber: String(formData.get("orderNumber") || form.orderNumber),
      comments: String(formData.get("comments") || form.comments),
    };
    setLoading(true);
    setMessage("");
    setError("");

    const res = await fetch("/api/regret-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok || !data?.ok) {
      setError(String(data?.error || "No se pudo enviar la solicitud."));
      return;
    }

    setForm({ name: "", email: "", phone: "", orderNumber: "", comments: "" });
    setMessage("Solicitud enviada. Te vamos a contactar para continuar el proceso.");
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 text-inherit hover:text-zinc-600">
        <ChevronSmall />
        Botón de arrepentimiento
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-12">
          <div className="w-full max-w-3xl bg-white text-[#222] shadow-2xl">
            <div className="flex items-start justify-between gap-6 px-8 py-7">
              <div>
                <h2 className="text-2xl font-light text-[#222]">Solicitud: cancelación de compra</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#70471F]">
                  La solicitud tendrá validez si es realizada dentro de los plazos determinados en la{" "}
                  <a
                    href="https://www.boletinoficial.gob.ar/detalleAviso/primera/235729/20201005"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-700 underline"
                  >
                    Resolución 424/2020
                  </a>{" "}
                  de la Secretaría de Comercio Interior y no se traten de productos exceptuados como productos personalizados y todos los comprendidos en el art. 1116 del Código Civil y Comercial.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="p-1 text-[#70471F] hover:text-black">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form className="border-t border-zinc-200 px-8 py-8" onSubmit={submit}>
              <div className="grid gap-5">
                <ModalField name="name" label="Nombre completo" value={form.name} onChange={(value) => update("name", value)} />
                <ModalField name="email" label="Email (con el que se realizó la compra)" type="email" value={form.email} onChange={(value) => update("email", value)} />
                <ModalField name="phone" label="Teléfono" value={form.phone} onChange={(value) => update("phone", value)} />
                <ModalField name="orderNumber" label="Número de orden sin # (te llegó por email al momento de realizar la compra)" value={form.orderNumber} onChange={(value) => update("orderNumber", value)} />
                <label className="block text-sm text-[#70471F]">
                  Aclaraciones: información sobre el inconveniente, productos que quieres devolver, dirección de retiro, otras observaciones.
                  <textarea
                    name="comments"
                    value={form.comments}
                    onChange={(event) => update("comments", event.target.value)}
                    className="mt-2 h-24 w-full resize-y border border-[#D8C5B4] bg-white px-3 py-2 text-[#222] outline-none focus:border-black"
                  />
                </label>
              </div>

              {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
              {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}

              <div className="mt-8 border-t border-zinc-200 pt-6 sm:flex sm:justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-12 py-3 text-sm font-medium uppercase shadow-sm disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  style={{ backgroundColor: "#000", color: "#fff", border: "1px solid #000" }}
                >
                  {loading ? "Enviando..." : "Enviar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ModalField({
  name,
  label,
  type = "text",
  value,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm text-[#70471F]">
      {label}
      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full border border-[#D8C5B4] bg-white px-3 text-[#222] outline-none focus:border-black"
      />
    </label>
  );
}

function ChevronSmall() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="currentColor" d="m9 18 6-6-6-6v12Z" />
    </svg>
  );
}
