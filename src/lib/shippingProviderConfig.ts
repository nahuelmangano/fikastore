import { prisma } from "@/lib/prisma";
import type { ShippingCarrierKey } from "@/lib/shippingCarriers";

export type ProviderKey = ShippingCarrierKey;

export type ProviderField = {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  secret?: boolean;
};

const CONFIG_FIELDS: Record<ProviderKey, ProviderField[]> = {
  epick: [
    { key: "EPICK_BASE_URL", label: "Base URL", placeholder: "https://dev-ar.e-pick.com.ar" },
    { key: "EPICK_PHONE", label: "Teléfono usuario", required: true },
    { key: "EPICK_PASSWORD", label: "Password usuario", required: true, secret: true },
    { key: "EPICK_WEBHOOK_URL", label: "Webhook URL", required: true },
    { key: "EPICK_SENDER_POSTAL_CODE", label: "CP remitente", required: true },
    { key: "EPICK_SENDER_NAME", label: "Nombre remitente", required: true },
    { key: "EPICK_SENDER_PHONE", label: "Teléfono remitente", required: true },
    { key: "EPICK_SENDER_EMAIL", label: "Email remitente", required: true },
    { key: "EPICK_SENDER_STREET", label: "Calle remitente", required: true },
    { key: "EPICK_SENDER_NUMBER", label: "Número remitente", required: true },
    { key: "EPICK_SENDER_CITY", label: "Ciudad remitente", required: true },
    { key: "EPICK_SENDER_PROVINCE", label: "Provincia remitente", required: true },
    { key: "EPICK_SENDER_EXTRA", label: "Extra remitente" },
    { key: "EPICK_SENDER_INFO", label: "Info remitente" },
    { key: "EPICK_ADDRESSEE_PROVINCE", label: "Provincia destinatario (fallback)" },
    { key: "EPICK_PKG_LONG", label: "Largo paquete (cm)", required: true },
    { key: "EPICK_PKG_WIDTH", label: "Ancho paquete (cm)", required: true },
    { key: "EPICK_PKG_HEIGHT", label: "Alto paquete (cm)", required: true },
    { key: "EPICK_PKG_WEIGHT", label: "Peso paquete (kg)", required: true },
  ],
  andreani: [
    { key: "ANDREANI_BASE_URL", label: "Base URL (opcional)" },
    { key: "ANDREANI_ENV", label: "Entorno (qa/prod)", placeholder: "qa" },
    { key: "ANDREANI_USER", label: "Usuario", required: true },
    { key: "ANDREANI_PASS", label: "Password", required: true, secret: true },
    { key: "ANDREANI_CONTRATO", label: "Contrato", required: true },
    { key: "ANDREANI_CLIENTE", label: "Cliente", required: true },
    { key: "ANDREANI_SUCURSAL_ORIGEN", label: "Sucursal origen" },
    { key: "ANDREANI_PKG_HEIGHT", label: "Alto paquete (cm)" },
    { key: "ANDREANI_PKG_WIDTH", label: "Ancho paquete (cm)" },
    { key: "ANDREANI_PKG_LONG", label: "Largo paquete (cm)" },
    { key: "ANDREANI_PKG_VOLUME", label: "Volumen paquete" },
    { key: "ANDREANI_PKG_WEIGHT", label: "Peso paquete (kg)" },
    { key: "ANDREANI_PKG_VALUE", label: "Valor declarado" },
  ],
  correo: [
    { key: "CORREO_ARG_BASE_URL", label: "Base URL (opcional)" },
    { key: "CORREO_ARG_ENV", label: "Entorno (qa/prod)", placeholder: "qa" },
    { key: "CORREO_ARG_USER", label: "Usuario", required: true },
    { key: "CORREO_ARG_PASS", label: "Password", required: true, secret: true },
    { key: "CORREO_ARG_CUSTOMER_ID", label: "Customer ID", required: true },
    { key: "CORREO_ARG_POSTAL_ORIGIN", label: "CP origen", required: true },
    { key: "CORREO_ARG_PRODUCT_TYPE", label: "Tipo producto", placeholder: "CP" },
    { key: "CORREO_ARG_DELIVERY_TYPE", label: "Tipo entrega (D/S)", placeholder: "D" },
    { key: "CORREO_ARG_PKG_WEIGHT_G", label: "Peso paquete (g)", required: true },
    { key: "CORREO_ARG_PKG_HEIGHT_CM", label: "Alto paquete (cm)", required: true },
    { key: "CORREO_ARG_PKG_WIDTH_CM", label: "Ancho paquete (cm)", required: true },
    { key: "CORREO_ARG_PKG_LENGTH_CM", label: "Largo paquete (cm)", required: true },
    { key: "CORREO_ARG_SENDER_NAME", label: "Nombre remitente", required: true },
    { key: "CORREO_ARG_SENDER_PHONE", label: "Teléfono remitente", required: true },
    { key: "CORREO_ARG_SENDER_CELLPHONE", label: "Celular remitente" },
    { key: "CORREO_ARG_SENDER_EMAIL", label: "Email remitente", required: true },
    { key: "CORREO_ARG_SENDER_STREET", label: "Calle remitente", required: true },
    { key: "CORREO_ARG_SENDER_NUMBER", label: "Número remitente", required: true },
    { key: "CORREO_ARG_SENDER_FLOOR", label: "Piso remitente" },
    { key: "CORREO_ARG_SENDER_APARTMENT", label: "Depto remitente" },
    { key: "CORREO_ARG_SENDER_CITY", label: "Ciudad remitente", required: true },
    { key: "CORREO_ARG_SENDER_PROVINCE_CODE", label: "Provincia remitente (código)", required: true },
    { key: "CORREO_ARG_SENDER_POSTAL_CODE", label: "CP remitente", required: true },
    { key: "CORREO_ARG_RECIPIENT_EMAIL", label: "Email destinatario fallback" },
    { key: "CORREO_ARG_RECIPIENT_PROVINCE_CODE", label: "Provincia destinatario fallback (código)" },
    { key: "CORREO_ARG_AGENCY", label: "Sucursal destino (si delivery=S)" },
  ],
  pickup: [],
};

type Cached = {
  expiresAt: number;
  map: Record<string, string>;
};

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map<string, Cached>();

export function getProviderFields(provider: ProviderKey) {
  return CONFIG_FIELDS[provider] || [];
}

async function getProviderMap(provider: ProviderKey) {
  const now = Date.now();
  const hit = cache.get(provider);
  if (hit && hit.expiresAt > now) return hit.map;

  const rows = await prisma.shippingProviderSetting.findMany({
    where: { provider },
    select: { key: true, value: true },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache.set(provider, { expiresAt: now + CACHE_TTL_MS, map });
  return map;
}

export function invalidateProviderConfig(provider: ProviderKey) {
  cache.delete(provider);
}

export async function getProviderConfigValue(provider: ProviderKey, key: string, fallback = "") {
  const map = await getProviderMap(provider);
  const fromDb = String(map[key] || "").trim();
  if (fromDb) return fromDb;
  const fromEnv = String(process.env[key] || "").trim();
  return fromEnv || fallback;
}

export async function listProviderConfig(provider: ProviderKey) {
  const fields = getProviderFields(provider);
  const map = await getProviderMap(provider);
  return fields.map((f) => ({
    ...f,
    value: map[f.key] ?? "",
    hasValue: Boolean(String(map[f.key] ?? "").trim()),
  }));
}
