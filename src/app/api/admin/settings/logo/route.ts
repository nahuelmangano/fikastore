import { NextResponse } from "next/server";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getStoreLogoUrl, setStoreLogoUrl } from "@/lib/storeSettings";

export const runtime = "nodejs";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const logoUrl = await getStoreLogoUrl();
  return NextResponse.json({ ok: true, logoUrl });
}

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Archivo requerido" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "El archivo debe ser una imagen" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const filename = `${crypto.randomUUID()}-${safeName(file.name)}`;
  const filepath = path.join(uploadsDir, filename);
  await writeFile(filepath, bytes);

  const logoUrl = `/uploads/${filename}`;
  await setStoreLogoUrl(logoUrl);

  return NextResponse.json({ ok: true, logoUrl });
}
