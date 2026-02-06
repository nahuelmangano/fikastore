import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { andreaniRequest, buildAndreaniQuery } from "@/lib/andreani";

export const runtime = "nodejs";

type Body = {
  cpDestino?: string;
};

function envString(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const cpDestino = body?.cpDestino?.trim();
  if (!cpDestino) {
    return NextResponse.json({ ok: false, error: "cpDestino requerido." }, { status: 400 });
  }

  let params: URLSearchParams;
  try {
    const contrato = envString("ANDREANI_CONTRATO");
    const cliente = envString("ANDREANI_CLIENTE");

    const altoCm = process.env.ANDREANI_PKG_HEIGHT;
    const anchoCm = process.env.ANDREANI_PKG_WIDTH;
    const largoCm = process.env.ANDREANI_PKG_LONG;

    const volumen = process.env.ANDREANI_PKG_VOLUME;
    const kilos = process.env.ANDREANI_PKG_WEIGHT;
    const valorDeclarado = process.env.ANDREANI_PKG_VALUE;
    const sucursalOrigen = process.env.ANDREANI_SUCURSAL_ORIGEN;

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
