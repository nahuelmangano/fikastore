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
  const configs = await Promise.all(
    carriers.map(async (carrier) => {
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
      carriers={carriers.map((c) => {
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
          deliveryDays: c.deliveryDays,
          shippingSurcharge: c.shippingSurcharge,
          freeShippingMinimumSubtotal: c.freeShippingMinimumSubtotal,
          configured: config?.configured ?? true,
          requiredCount: config?.requiredCount ?? 0,
          completedCount: config?.completedCount ?? 0,
        };
      })}
      canManageMerchantVisibility={isAdmin}
    />
  );
}
