import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getInstallmentPlans, setInstallmentPlans } from "@/lib/storeSettings";

async function authorized() {
  const session = await auth();
  return isStaffRole((session?.user as { role?: string } | undefined)?.role);
}

export async function GET() {
  if (!(await authorized())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  return NextResponse.json({ ok: true, plans: await getInstallmentPlans() });
}

export async function PATCH(req: Request) {
  if (!(await authorized())) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { plans?: unknown };
  await setInstallmentPlans(body.plans);
  return NextResponse.json({ ok: true, plans: await getInstallmentPlans() });
}
