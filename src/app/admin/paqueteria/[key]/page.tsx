import { notFound } from "next/navigation";
import { getShippingCarriers } from "@/lib/shippingCarriers";
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
  const carriers = await getShippingCarriers();
  const carrier = carriers.find((c) => c.key === key);
  if (!carrier) return notFound();

  return <AdminCarrierConfig providerKey={carrier.key as ShippingCarrierKey} providerName={carrier.name} />;
}
