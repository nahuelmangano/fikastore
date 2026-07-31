import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  canEncryptMercadoPagoSecrets,
  clearMercadoPagoSettings,
  getMercadoPagoSettings,
  setMercadoPagoSettings,
} from "@/lib/storeSettings";
import { isAdminRole, isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true, settings: await getMercadoPagoSettings() });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isAdminRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const accessToken = String(body.accessToken || "").trim();

  if (!accessToken) {
    return NextResponse.json({ ok: false, error: "Ingresá el Access Token de MercadoPago." }, { status: 400 });
  }

  if (accessToken.length > 600) {
    return NextResponse.json({ ok: false, error: "El Access Token es demasiado largo." }, { status: 400 });
  }

  if (!canEncryptMercadoPagoSecrets()) {
    return NextResponse.json(
      { ok: false, error: "Falta configurar APP_SECRET_ENCRYPTION_KEY o MAILING_ENCRYPTION_KEY para guardar credenciales." },
      { status: 400 }
    );
  }

  await setMercadoPagoSettings({ accessToken });
  return NextResponse.json({ ok: true, settings: await getMercadoPagoSettings() });
}

export async function DELETE() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (role !== "merchant") return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  await clearMercadoPagoSettings();
  return NextResponse.json({ ok: true, settings: await getMercadoPagoSettings() });
}
