import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/passwordReset";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || "").trim();

    if (!email) {
      return NextResponse.json({ ok: false, error: "Ingresá tu email." }, { status: 400 });
    }

    await requestPasswordReset(req, email);

    return NextResponse.json({
      ok: true,
      message: "Si existe una cuenta con ese email, te enviamos un enlace para restablecer la contraseña.",
    });
  } catch (error) {
    console.error("forgot password error", error);
    return NextResponse.json({ ok: false, error: "No se pudo procesar la solicitud." }, { status: 500 });
  }
}
