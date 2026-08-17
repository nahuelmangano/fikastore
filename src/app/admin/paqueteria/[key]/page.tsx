import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getShippingCarriers } from "@/lib/shippingCarriers";
import { isAdminRole } from "@/lib/roles";
import AdminCarrierConfig from "./ui";
import type { ShippingCarrierKey } from "@/lib/shippingCarriers";

type Params = { key?: string };

export default async function AdminCarrierConfigPage({
  params,
}: {
  params: Params | Promise<Params>;
}) {
  const resolved = await Promise.resolve(params);
  const key = String(resolved?.key || "").trim();
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = isAdminRole(role);
  const carriers = await getShippingCarriers({ visibleToMerchantOnly: !isAdmin });
  const carrier = carriers.find((c) => c.key === key);
  if (!carrier) return notFound();

  return (
    <AdminCarrierConfig
      providerKey={carrier.key as ShippingCarrierKey}
      providerName={carrier.name}
      canCreateTestShipments={isAdmin}
    />
  );
}
