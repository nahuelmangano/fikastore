import { getShippingCarriers } from "@/lib/shippingCarriers";
import AdminPaqueteria from "./ui";

export default async function AdminPaqueteriaPage() {
  const carriers = await getShippingCarriers();

  return <AdminPaqueteria carriers={carriers.map((c) => ({ key: c.key, name: c.name, enabled: c.enabled }))} />;
}

