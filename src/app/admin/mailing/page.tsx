import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canEncryptMailingSecrets, getMailingSettings } from "@/lib/storeSettings";
import { isAdminRole, isStaffRole } from "@/lib/roles";
import AdminMailingPage from "./ui";

export default async function MailingPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) redirect("/admin");

  const settings = await getMailingSettings();
  return (
    <AdminMailingPage
      initialSettings={settings}
      canSaveSmtpSecrets={canEncryptMailingSecrets()}
      canManageSmtp={isAdminRole(role)}
    />
  );
}
