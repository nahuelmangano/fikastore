import { prisma } from "@/lib/prisma";

export type ShippingCarrierKey = "epick" | "andreani" | "correo" | "pickup";

const DEFAULT_CARRIERS: { key: ShippingCarrierKey; name: string; enabled: boolean }[] = [
  { key: "epick", name: "E-pick", enabled: true },
  { key: "andreani", name: "Andreani", enabled: true },
  { key: "correo", name: "Correo Argentino", enabled: true },
  { key: "pickup", name: "Retiro en comercio", enabled: true },
];

function orderByDefault(a: { key: string }, b: { key: string }) {
  const order = new Map(DEFAULT_CARRIERS.map((c, i) => [c.key, i]));
  const ai = order.get(a.key as ShippingCarrierKey) ?? 999;
  const bi = order.get(b.key as ShippingCarrierKey) ?? 999;
  return ai - bi;
}

export async function getShippingCarriers() {
  const existing = await prisma.shippingCarrier.findMany();
  const byKey = new Map(existing.map((c) => [c.key, c]));
  const missing = DEFAULT_CARRIERS.filter((c) => !byKey.has(c.key));

  if (missing.length > 0) {
    for (const c of missing) {
      try {
        await prisma.shippingCarrier.create({ data: c });
      } catch (e: any) {
        const code = e?.code || e?.meta?.cause;
        if (code !== "P2002") throw e;
      }
    }
  }

  const list = await prisma.shippingCarrier.findMany();
  return list.sort(orderByDefault);
}

export async function isCarrierEnabled(key: ShippingCarrierKey): Promise<boolean> {
  const list = await getShippingCarriers();
  const found = list.find((c) => c.key === key);
  return found ? found.enabled : true;
}

export function getDefaultCarrierOrder() {
  return DEFAULT_CARRIERS.map((c) => c.key);
}
