import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getInformationSections, setInformationSections } from "@/lib/informationSections";
import { isStaffRole } from "@/lib/roles";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const sections = await getInformationSections();
  return NextResponse.json({ ok: true, sections });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rawSections = Array.isArray(body.sections) ? body.sections.slice(0, 20) : [];

  const missingTitle = rawSections.find((section: unknown) => {
    if (!section || typeof section !== "object") return true;
    return !String((section as { title?: unknown }).title || "").trim();
  });

  if (missingTitle) {
    return NextResponse.json({ ok: false, error: "Todas las secciones necesitan un titulo." }, { status: 400 });
  }

  const sections = await setInformationSections(rawSections);
  return NextResponse.json({ ok: true, sections });
}
