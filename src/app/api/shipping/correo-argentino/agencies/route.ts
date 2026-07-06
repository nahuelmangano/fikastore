import { NextResponse } from "next/server";
import { correoArgentinoRequest } from "@/lib/correoArgentino";
import { isCarrierEnabled } from "@/lib/shippingCarriers";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";

export const runtime = "nodejs";

type Body = {
  provinceCode?: string;
};

type AgencyResponse = {
  code?: string;
  name?: string;
  status?: string;
  services?: {
    packageReception?: boolean;
    pickupAvailability?: boolean;
  };
  location?: {
    address?: {
      streetName?: string | null;
      streetNumber?: string | null;
      city?: string | null;
      province?: string | null;
      provinceCode?: string | null;
      postalCode?: string | null;
    };
  };
};

async function requireCustomerId() {
  const customerId = (await getProviderConfigValue("correo", "CORREO_ARG_CUSTOMER_ID")).trim();
  if (!customerId) throw new Error("CORREO_ARG_CUSTOMER_ID no configurado.");
  return customerId;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const provinceCode = body?.provinceCode?.trim().toUpperCase();
  if (!provinceCode) {
    return NextResponse.json({ ok: false, error: "provinceCode requerido." }, { status: 400 });
  }

  if (!(await isCarrierEnabled("correo"))) {
    return NextResponse.json({ ok: false, error: "Correo Argentino no esta habilitado." }, { status: 409 });
  }

  try {
    const params = new URLSearchParams();
    params.set("customerId", await requireCustomerId());
    params.set("provinceCode", provinceCode);
    params.set("services", "pickup_availability");

    const data = await correoArgentinoRequest<AgencyResponse[]>(`/agencies?${params.toString()}`);
    const agencies = Array.isArray(data)
      ? data
          .filter((agency) => {
            if (String(agency?.status || "").toUpperCase() !== "ACTIVE") return false;
            return agency?.services?.pickupAvailability !== false;
          })
          .map((agency) => {
            const address = agency.location?.address;
            const streetName = String(address?.streetName || "").trim();
            const streetNumber = String(address?.streetNumber || "").trim();
            return {
              code: String(agency.code || "").trim(),
              name: String(agency.name || "").trim(),
              addressLine: [streetName, streetNumber].filter(Boolean).join(" "),
              city: String(address?.city || "").trim(),
              province: String(address?.province || "").trim(),
              provinceCode: String(address?.provinceCode || "").trim().toUpperCase(),
              zip: String(address?.postalCode || "").trim(),
            };
          })
          .filter((agency) => agency.code && agency.name && agency.zip)
      : [];

    return NextResponse.json({ ok: true, agencies });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudieron consultar las sucursales de Correo Argentino.",
        details: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }
}
