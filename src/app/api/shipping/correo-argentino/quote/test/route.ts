import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { correoArgentinoRequest } from "@/lib/correoArgentino";

export const runtime = "nodejs";

function envInt(name: string, def: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.round(v) : def;
}

function clampDim(n: number) {
  return Math.min(150, Math.max(1, Math.round(n)));
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} no configurado.`);
  return v;
}

export async function GET() {
  const session = await auth();
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let payload: any;
  try {
    const weight = Math.min(25000, envInt("CORREO_ARG_PKG_WEIGHT_G", 1000));
    const height = clampDim(envInt("CORREO_ARG_PKG_HEIGHT_CM", 10));
    const width = clampDim(envInt("CORREO_ARG_PKG_WIDTH_CM", 20));
    const length = clampDim(envInt("CORREO_ARG_PKG_LENGTH_CM", 30));

    payload = {
      customerId: requireEnv("CORREO_ARG_CUSTOMER_ID"),
      postalCodeOrigin: "1757",
      postalCodeDestination: "1704",
      dimensions: { weight, height, width, length },
    };
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }

  try {
    const data = await correoArgentinoRequest<any>("/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return NextResponse.json({ ok: true, quote: data, payload });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "No se pudo cotizar Correo Argentino (test).",
        details: String(e?.message || e),
        debug:
          process.env.CORREO_ARG_DEBUG === "1"
            ? { status: e?.status, data: e?.data, text: e?.text }
            : undefined,
        payload,
      },
      { status: 502 }
    );
  }
}

