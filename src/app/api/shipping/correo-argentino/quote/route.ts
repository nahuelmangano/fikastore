import { NextResponse } from "next/server";
import { correoArgentinoRequest } from "@/lib/correoArgentino";
import { isCarrierEnabled } from "@/lib/shippingCarriers";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";
import { validateArgentinaPostalCodeProvince } from "@/lib/argentinaPostalCode";

export const runtime = "nodejs";

type Body = {
  postalCode?: string;
  provinceCode?: string;
  deliveryType?: string;
};

type CorreoRate = {
  deliveredType?: string;
  productType?: string;
  price?: number;
};

type CorreoQuoteResponse = {
  customerId?: string;
  productType?: string;
  deliveredType?: string;
  postalCodeOrigin?: string;
  postalCodeDestination?: string;
  rates?: CorreoRate[];
  [key: string]: unknown;
};

type RatesPayload = {
  customerId: string;
  postalCodeOrigin: string;
  postalCodeDestination: string;
  productType?: string;
  deliveredType?: string;
  dimensions: {
    weight: number;
    height: number;
    width: number;
    length: number;
  };
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
  const provinceCode = body?.provinceCode?.trim();
  const requestedDeliveryType = body?.deliveryType?.trim().toUpperCase();
  if (!postalCode) {
    return NextResponse.json({ ok: false, error: "postalCode requerido." }, { status: 400 });
  }

  const postalCodeProvinceError = validateArgentinaPostalCodeProvince(postalCode, provinceCode || "");
  if (postalCodeProvinceError) {
    return NextResponse.json({ ok: false, error: postalCodeProvinceError }, { status: 400 });
  }

  if (!(await isCarrierEnabled("correo"))) {
    return NextResponse.json({ ok: false, error: "Correo Argentino no esta habilitado." }, { status: 409 });
  }

  let payload: RatesPayload;
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

    if (requestedDeliveryType === "D" || requestedDeliveryType === "S") {
      payload.deliveredType = requestedDeliveryType;
    }
  } catch (e: unknown) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }

  try {
    const toFormBody = (p: RatesPayload) => {
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

    const fetchRates = async (p: RatesPayload) => {
      if (process.env.CORREO_ARG_DEBUG === "1") {
        console.log("[correo-argentino] rates payload", JSON.stringify(p));
      }
      let data: CorreoQuoteResponse;
      try {
        data = await correoArgentinoRequest<CorreoQuoteResponse>("/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
      } catch (err: unknown) {
        const status =
          typeof err === "object" && err && "status" in err && typeof err.status === "number"
            ? err.status
            : undefined;
        if (status === 415) {
          data = await correoArgentinoRequest<CorreoQuoteResponse>("/rates", {
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

    const attempts = payload.deliveredType ? [payload.deliveredType] : ["D", "S"];

    let last: CorreoQuoteResponse | null = null;
    let baseResponse: CorreoQuoteResponse | null = null;
    const mergedRates: CorreoRate[] = [];
    for (const dt of attempts) {
      const { data, hasRates } = await fetchRates({ ...payload, deliveredType: dt });
      last = data;
      if (!baseResponse && data) baseResponse = data;
      if (Array.isArray(data?.rates)) {
        for (const rate of data.rates) {
          const exists = mergedRates.some(
            (current) =>
              current?.deliveredType === rate?.deliveredType &&
              current?.productType === rate?.productType &&
              Number(current?.price) === Number(rate?.price)
          );
          if (!exists) mergedRates.push(rate);
        }
      }
      if (payload.deliveredType && hasRates) {
        return NextResponse.json({ ok: true, quote: data });
      }
    }

    if (mergedRates.length > 0) {
      return NextResponse.json({
        ok: true,
        quote: {
          ...(baseResponse || {}),
          rates: mergedRates,
        },
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Correo Argentino no devolvio tarifas.",
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
  } catch (e: unknown) {
    const errorObj = typeof e === "object" && e ? e : null;
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cotizar Correo Argentino.",
        details,
        ...(process.env.CORREO_ARG_DEBUG === "1"
          ? {
              debug: {
                status: errorObj && "status" in errorObj ? errorObj.status : undefined,
                data: errorObj && "data" in errorObj ? errorObj.data : undefined,
                text: errorObj && "text" in errorObj ? errorObj.text : undefined,
              },
            }
          : {}),
      },
      { status: 502 }
    );
  }
}
