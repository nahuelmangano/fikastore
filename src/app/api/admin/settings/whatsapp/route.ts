import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { setWhatsappMessageTemplate } from "@/lib/storeSettings";
import { WHATSAPP_MESSAGE_MAX_LENGTH } from "@/lib/whatsapp";

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (typeof body?.message !== "string" || body.message.length > WHATSAPP_MESSAGE_MAX_LENGTH) {
    return NextResponse.json({ error: `El mensaje debe tener hasta ${WHATSAPP_MESSAGE_MAX_LENGTH} caracteres.` }, { status: 400 });
  }
  try {
    await setWhatsappMessageTemplate(body.message);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar el mensaje." }, { status: 500 });
  }
}
