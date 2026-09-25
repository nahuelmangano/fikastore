import { auth } from "@/auth";
import { isAdminRole } from "@/lib/roles";
import { getShippingCarriers } from "@/lib/shippingCarriers";
import { listProviderConfig, type ProviderKey } from "@/lib/shippingProviderConfig";
import AdminPaqueteria from "./ui";

export default async function AdminPaqueteriaPage() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isAdmin = isAdminRole(role);
  const carriers = await getShippingCarriers({ visibleToMerchantOnly: !isAdmin });
  const panelCarriers = carriers.filter((carrier) => carrier.key !== "pickup");
  const configs = await Promise.all(
    panelCarriers.map(async (carrier) => {
      if (carrier.custom) {
        return {
          key: carrier.key,
          requiredCount: 0,
          completedCount: 0,
          configured: true,
        };
      }
      const fields = await listProviderConfig(carrier.key as ProviderKey);
      const required = fields.filter((field) => field.required);
      const completed = required.filter((field) => field.hasValue);
      return {
        key: carrier.key,
        requiredCount: required.length,
        completedCount: completed.length,
        configured: required.length === completed.length,
      };
    })
  );
  const configByKey = new Map(configs.map((config) => [config.key, config]));

  return (
    <AdminPaqueteria
      carriers={panelCarriers.map((c) => {
        const config = configByKey.get(c.key);
        return {
          key: c.key,
          name: c.name,
          enabled: c.enabled,
          visibleToMerchant: c.visibleToMerchant,
          custom: c.custom,
          description: c.description,
          flatRate: c.flatRate,
          pricingMode: c.pricingMode,
          pickupPoints: c.pickupPoints,
          deliveryDays: c.deliveryDays,
          shippingSurcharge: c.shippingSurcharge,
          freeShippingMinimumSubtotal: c.freeShippingMinimumSubtotal,
          freeShippingMinimumDeliveryTypes: c.freeShippingMinimumDeliveryTypes,
          configured: config?.configured ?? true,
          requiredCount: config?.requiredCount ?? 0,
          completedCount: config?.completedCount ?? 0,
        };
      })}
      canManageMerchantVisibility={isAdmin}
    />
  );
}
