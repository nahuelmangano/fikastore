import { NextResponse } from "next/server";
import { andreaniRequest, buildAndreaniQuery } from "@/lib/andreani";
import { isCarrierEnabled } from "@/lib/shippingCarriers";
import { getProviderConfigValue } from "@/lib/shippingProviderConfig";

export const runtime = "nodejs";

type Body = {
  cpDestino?: string;
};

async function envString(name: string) {
  const v = await getProviderConfigValue("andreani", name);
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const cpDestino = body?.cpDestino?.trim();
  if (!cpDestino) {
    return NextResponse.json({ ok: false, error: "cpDestino requerido." }, { status: 400 });
  }

  if (!(await isCarrierEnabled("andreani"))) {
    return NextResponse.json({ ok: false, error: "Andreani no está habilitado." }, { status: 409 });
  }

  let params: URLSearchParams;
  try {
    const contrato = await envString("ANDREANI_CONTRATO");
    const cliente = await envString("ANDREANI_CLIENTE");

    const altoCm = await getProviderConfigValue("andreani", "ANDREANI_PKG_HEIGHT");
    const anchoCm = await getProviderConfigValue("andreani", "ANDREANI_PKG_WIDTH");
    const largoCm = await getProviderConfigValue("andreani", "ANDREANI_PKG_LONG");

    const volumen = await getProviderConfigValue("andreani", "ANDREANI_PKG_VOLUME");
    const kilos = await getProviderConfigValue("andreani", "ANDREANI_PKG_WEIGHT");
    const valorDeclarado = await getProviderConfigValue("andreani", "ANDREANI_PKG_VALUE");
    const sucursalOrigen = await getProviderConfigValue("andreani", "ANDREANI_SUCURSAL_ORIGEN");

    params = buildAndreaniQuery({
      cpDestino,
      contrato,
      cliente,
      volumen,
      kilos,
      valorDeclarado,
      altoCm,
      anchoCm,
      largoCm,
      sucursalOrigen,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }

  try {
    const data = await andreaniRequest<any>(`/v1/tarifas?${params.toString()}`, {
      method: "GET",
    });
    return NextResponse.json({ ok: true, quote: data });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "No se pudo cotizar Andreani.", details: String(e?.message || e) },
      { status: 502 }
    );
  }
}
