import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isStaffRole } from "@/lib/roles";
import RegretRequestsAdmin from "./ui";

export default async function AdminRegretRequestsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) redirect("/admin");

  const requests = await prisma.regretRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-[#FAF8F5] px-4 py-8 text-[#5F3B18] md:ml-64">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#A37A55]">Admin · Legal</p>
            <h1 className="text-2xl font-bold">Botón de arrepentimiento</h1>
            <p className="mt-1 text-sm text-[#8B6A4B]">Solicitudes enviadas desde el footer de la tienda.</p>
          </div>
          <Link href="/admin" className="rounded-xl border border-[#E5D7C8] bg-white px-4 py-2 text-sm font-semibold text-[#8B5A2B]">
            Volver
          </Link>
        </div>

        <RegretRequestsAdmin
          requests={requests.map((request) => ({
            id: request.id,
            orderId: request.orderId,
            orderNumber: request.orderNumber,
            name: request.name,
            email: request.email,
            phone: request.phone,
            comments: request.comments,
            status: request.status,
            createdAt: request.createdAt.toISOString(),
            order: request.order
              ? {
                  id: request.order.id,
                  orderNumber: request.order.orderNumber,
                  status: request.order.status,
                  total: Number(request.order.total),
                  createdAt: request.order.createdAt.toISOString(),
                  user: request.order.user,
                }
              : null,
          }))}
        />
      </div>
    </main>
  );
}
