import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMercadoPagoOAuthPaymentContext } from "@/lib/storeSettings";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  if (process.env.MERCADOPAGO_DEBUG !== "true") {
    return NextResponse.json({ ok: false, error: "Mercado Pago diagnostics are disabled." }, { status: 404 });
  }

  const oauthContext = await getMercadoPagoOAuthPaymentContext();
  if (!oauthContext?.accessToken) {
    return NextResponse.json({ ok: false, error: "No stored OAuth seller token." }, { status: 409 });
  }

  try {
    const response = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${oauthContext.accessToken}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const responseUserId = data.id !== undefined ? String(data.id) : undefined;

    return NextResponse.json({
      ok: response.ok,
      endpoint: "/users/me",
      status: response.status,
      requestId: response.headers.get("x-request-id") || undefined,
      connectedUserId: oauthContext.connectedUserId || null,
      responseUserId: responseUserId || null,
      userIdMatches: oauthContext.connectedUserId && responseUserId
        ? oauthContext.connectedUserId === responseUserId
        : null,
      error: response.ok ? undefined : {
        code: typeof data.code === "string" ? data.code : undefined,
        message: typeof data.message === "string" ? data.message : undefined,
      },
    }, { status: response.ok ? 200 : 502 });
  } catch (error) {
    console.error("Mercado Pago OAuth diagnostics failed", {
      message: error instanceof Error ? error.message : "request failed",
    });
    return NextResponse.json({ ok: false, error: "Could not reach Mercado Pago." }, { status: 502 });
  }
}
