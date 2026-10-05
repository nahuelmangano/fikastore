"use client";

import { useState } from "react";
import Link from "next/link";

type RegretRequestRow = {
  id: string;
  orderId: string | null;
  orderNumber: number | null;
  name: string;
  email: string;
  phone: string;
  comments: string;
  status: string;
  createdAt: string;
  order: {
    id: string;
    orderNumber: number;
    status: string;
    total: number;
    createdAt: string;
    user: { email: string | null; name: string | null } | null;
  } | null;
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "IN_REVIEW", label: "En revisión" },
  { value: "RESOLVED", label: "Resuelta" },
  { value: "REJECTED", label: "Rechazada" },
];

function statusLabel(status: string) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(value);
}

export default function RegretRequestsAdmin({ requests }: { requests: RegretRequestRow[] }) {
  const [rows, setRows] = useState(requests);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function updateStatus(id: string, status: string) {
    setBusyId(id);
    setMsg("");
    const res = await fetch(`/api/admin/regret-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json().catch(() => null);
    setBusyId(null);
    if (!res.ok || !data?.ok) {
      setMsg(String(data?.error || "No se pudo actualizar la solicitud."));
      return;
    }
    setRows((current) => current.map((row) => row.id === id ? { ...row, status: data.request.status } : row));
    setMsg("Solicitud actualizada.");
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#E5D7C8] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-[#70471F]">Solicitudes</h2>
        <span className="text-sm text-[#A37A55]">{rows.length} registros</span>
      </div>
      {msg ? <p className="mt-3 text-sm text-[#8B5A2B]">{msg}</p> : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="text-left text-[#A37A55]">
            <tr className="border-b border-[#E5D7C8]">
              <th className="py-3 pr-4">Fecha</th>
              <th className="py-3 pr-4">Cliente</th>
              <th className="py-3 pr-4">Orden</th>
              <th className="py-3 pr-4">Aclaraciones</th>
              <th className="py-3 pr-4">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((request) => (
              <tr key={request.id} className="border-b border-[#EADCCD] align-top last:border-b-0">
                <td className="py-4 pr-4 text-[#8B6A4B]">
                  {new Date(request.createdAt).toLocaleString("es-AR")}
                </td>
                <td className="py-4 pr-4">
                  <div className="font-semibold text-[#70471F]">{request.name}</div>
                  <div className="mt-1 text-[#8B6A4B]">{request.email}</div>
                  <div className="mt-1 text-[#8B6A4B]">{request.phone}</div>
                </td>
                <td className="py-4 pr-4">
                  <div className="font-semibold">#{request.orderNumber || "-"}</div>
                  {request.order ? (
                    <>
                      <Link href={`/admin/orders/${request.order.id}`} className="mt-1 block text-[#8B5A2B] underline">
                        Ver pedido
                      </Link>
                      <div className="mt-1 text-xs text-[#8B6A4B]">
                        {request.order.status} · {money(request.order.total)}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-xs text-red-700">No vinculado por email/orden</div>
                  )}
                </td>
                <td className="max-w-md py-4 pr-4 text-[#6F4B2B]">
                  <p className="whitespace-pre-wrap">{request.comments}</p>
                </td>
                <td className="py-4 pr-4">
                  <select
                    value={request.status}
                    onChange={(event) => updateStatus(request.id, event.target.value)}
                    disabled={busyId === request.id}
                    className="rounded-xl border border-[#E5D7C8] bg-white px-3 py-2 text-sm font-semibold text-[#70471F] outline-none"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <div className="mt-2 text-xs text-[#A37A55]">{busyId === request.id ? "Guardando..." : statusLabel(request.status)}</div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#8B6A4B]">
                  Todavía no hay solicitudes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
