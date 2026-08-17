import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getCustomDomainSettings, setCustomDomain, verifyCustomDomainDns } from "@/lib/customDomain";

export const runtime = "nodejs";

function forbidden() {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}

async function requireStaffRole() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return isStaffRole(role);
}

export async function GET() {
  if (!(await requireStaffRole())) return forbidden();

  const settings = await getCustomDomainSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  if (!(await requireStaffRole())) return forbidden();

  const body = await req.json().catch(() => ({}));
  const domain = String(body.customDomain || "");

  try {
    const settings = await setCustomDomain(domain);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Ese dominio ya está registrado en otra tienda." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar el dominio." },
      { status: 400 },
    );
  }
}

export async function POST() {
  if (!(await requireStaffRole())) return forbidden();

  const settings = await verifyCustomDomainDns();
  return NextResponse.json({ ok: true, settings });
}
