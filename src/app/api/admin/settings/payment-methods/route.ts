import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import {
  getManualPaymentSettings,
  getPaymentFinancingDisplaySettings,
  setManualPaymentSettings,
  setPaymentFinancingDisplaySettings,
} from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const [methods, savedFinancingDisplay] = await Promise.all([
    getManualPaymentSettings(),
    getPaymentFinancingDisplaySettings(),
  ]);
  return NextResponse.json({ ok: true, methods, financingDisplay: savedFinancingDisplay });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const currentFinancingDisplay = await getPaymentFinancingDisplaySettings();
  const financingDisplay = role === "admin"
    ? body.financingDisplay
    : {
        ...body.financingDisplay,
        merchantCanSee: currentFinancingDisplay.merchantCanSee,
        merchantOptions: currentFinancingDisplay.merchantOptions,
      };
  await Promise.all([
    setManualPaymentSettings(body.methods),
    setPaymentFinancingDisplaySettings(financingDisplay),
  ]);

  const [methods, savedFinancingDisplay] = await Promise.all([
    getManualPaymentSettings(),
    getPaymentFinancingDisplaySettings(),
  ]);
  return NextResponse.json({ ok: true, methods, financingDisplay: savedFinancingDisplay });
}
