import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminRole } from "@/lib/roles";
import { getScreenTextSettings } from "@/lib/storeSettings";
import AdminScreensPage from "./ui";

export default async function AdminPantallasPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!isAdminRole(role)) redirect("/admin");

  const settings = await getScreenTextSettings();
  return <AdminScreensPage initialSettings={settings} />;
}
