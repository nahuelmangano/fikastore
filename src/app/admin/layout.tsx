import type { ReactNode } from "react";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/roles";
import AdminSideNav from "@/components/AdminSideNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = isAdminRole(role);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#70471F]">
      <AdminSideNav isAdmin={isAdmin} />
      <div className="min-h-screen md:pl-64">{children}</div>
    </div>
  );
}
