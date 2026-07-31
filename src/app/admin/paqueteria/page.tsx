import { getShippingCarriers } from "@/lib/shippingCarriers";
import { listProviderConfig, type ProviderKey } from "@/lib/shippingProviderConfig";
import AdminPaqueteria from "./ui";

export default async function AdminPaqueteriaPage() {
  const carriers = await getShippingCarriers();
  const configs = await Promise.all(
    carriers.map(async (carrier) => {
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
          configured: config?.configured ?? true,
          requiredCount: config?.requiredCount ?? 0,
          completedCount: config?.completedCount ?? 0,
        };
      })}
    />
  );
}
