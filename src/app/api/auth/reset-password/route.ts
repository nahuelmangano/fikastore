import { NextResponse } from "next/server";
import { consumePasswordResetToken, validatePasswordResetToken } from "@/lib/passwordReset";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = String(searchParams.get("token") || "").trim();

  if (!token) {
    return NextResponse.json({ ok: false, error: "Falta el token." }, { status: 400 });
  }

  const result = await validatePasswordResetToken(token);
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const password = String(body.password || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!token) {
      return NextResponse.json({ ok: false, error: "Falta el token." }, { status: 400 });
    }
    if (!password || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Completá todos los campos." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, error: "Las contraseñas no coinciden." }, { status: 400 });
    }

    const result = await consumePasswordResetToken(token, password);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("reset password error", error);
    return NextResponse.json({ ok: false, error: "No se pudo restablecer la contraseña." }, { status: 500 });
  }
}
