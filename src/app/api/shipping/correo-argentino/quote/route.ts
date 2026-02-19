import { NextResponse } from "next/server";
import { correoArgentinoRequest } from "@/lib/correoArgentino";
import { isCarrierEnabled } from "@/lib/shippingCarriers";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";

export const runtime = "nodejs";

type Body = {
  postalCode?: string;
};

async function envNumber(name: string, def: number) {
  const v = Number(await getProviderConfigValue("correo", name, String(def)));
  return Number.isFinite(v) && v > 0 ? v : def;
}

async function envInt(name: string, def: number) {
  const v = await envNumber(name, def);
  return Math.max(1, Math.round(v));
}

function clampDim(n: number) {
  return Math.min(150, Math.max(1, Math.round(n)));
}

async function requireEnv(name: string) {
  const v = await getProviderConfigValue("correo", name);
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const postalCode = body?.postalCode?.trim();
  if (!postalCode) {
    return NextResponse.json({ ok: false, error: "postalCode requerido." }, { status: 400 });
  }

  if (!(await isCarrierEnabled("correo"))) {
    return NextResponse.json({ ok: false, error: "Correo Argentino no está habilitado." }, { status: 409 });
  }

  let payload: any;
  try {
    const weight = Math.min(25000, await envInt("CORREO_ARG_PKG_WEIGHT_G", 1000));
    const height = clampDim(await envInt("CORREO_ARG_PKG_HEIGHT_CM", 10));
    const width = clampDim(await envInt("CORREO_ARG_PKG_WIDTH_CM", 20));
    const length = clampDim(await envInt("CORREO_ARG_PKG_LENGTH_CM", 30));

    payload = {
      customerId: await requireEnv("CORREO_ARG_CUSTOMER_ID"),
      postalCodeOrigin: await requireEnv("CORREO_ARG_POSTAL_ORIGIN"),
      postalCodeDestination: postalCode,
      dimensions: {
        weight,
        height,
        width,
        length,
      },
    };

    const productType = (await getProviderConfigValue("correo", "CORREO_ARG_PRODUCT_TYPE")).trim();
    if (productType) payload.productType = productType;

    const deliveredType = (await getProviderConfigValue("correo", "CORREO_ARG_DELIVERY_TYPE")).trim().toUpperCase();
    if (deliveredType === "D" || deliveredType === "S") {
      payload.deliveredType = deliveredType;
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }

  try {
    const toFormBody = (p: any) => {
      const form = new URLSearchParams();
      form.set("customerId", String(p.customerId));
      form.set("postalCodeOrigin", String(p.postalCodeOrigin));
      form.set("postalCodeDestination", String(p.postalCodeDestination));
      if (p.productType) form.set("productType", String(p.productType));
      if (p.deliveredType) form.set("deliveredType", String(p.deliveredType));
      form.set("dimensions.weight", String(p.dimensions?.weight ?? ""));
      form.set("dimensions.height", String(p.dimensions?.height ?? ""));
      form.set("dimensions.width", String(p.dimensions?.width ?? ""));
      form.set("dimensions.length", String(p.dimensions?.length ?? ""));
      return form.toString();
    };

    const fetchRates = async (p: any) => {
      if (process.env.CORREO_ARG_DEBUG === "1") {
        console.log("[correo-argentino] rates payload", JSON.stringify(p));
      }
      let data: any;
      try {
        data = await correoArgentinoRequest<any>("/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      } catch (err: any) {
        if (err?.status === 415) {
          data = await correoArgentinoRequest<any>("/rates", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: toFormBody(p),
          });
        } else {
          throw err;
        }
      }

      const hasRates = Array.isArray(data?.rates) && data.rates.length > 0;
      if (process.env.CORREO_ARG_DEBUG === "1") {
        console.log(
          "[correo-argentino] rates response",
          JSON.stringify({ hasRates, customerId: data?.customerId, rates: data?.rates })
        );
      }
      return { data, hasRates };
    };

    const attempts = payload.deliveredType
      ? ([payload.deliveredType, payload.deliveredType === "D" ? "S" : "D"] as const)
      : (["D", "S"] as const);

    let last: any = null;
    for (const dt of attempts) {
      const { data, hasRates } = await fetchRates({ ...payload, deliveredType: dt });
      last = data;
      if (hasRates) return NextResponse.json({ ok: true, quote: data });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Correo Argentino no devolvió tarifas.",
        details: {
          customerId: payload.customerId,
          postalCodeOrigin: payload.postalCodeOrigin,
          postalCodeDestination: payload.postalCodeDestination,
          productType: payload.productType,
          lastResponse: last,
        },
      },
      { status: 502 }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cotizar Correo Argentino.",
        details: String(e?.message || e),
        ...(process.env.CORREO_ARG_DEBUG === "1"
          ? {
              debug: {
                status: e?.status,
                data: e?.data,
                text: e?.text,
              },
            }
          : {}),
      },
      { status: 502 }
    );
  }
}
