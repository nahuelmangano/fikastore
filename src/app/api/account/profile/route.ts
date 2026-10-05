import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function parseBirthDate(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error("Fecha de nacimiento inválida.");
  }

  const [year, month, day] = raw.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("Fecha de nacimiento inválida.");
  }
  if (date > new Date()) {
    throw new Error("La fecha de nacimiento no puede ser futura.");
  }
  if (year < 1900) {
    throw new Error("Fecha de nacimiento inválida.");
  }

  return date;
}

async function currentUserId() {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, birthDate: true },
  });
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    ok: true,
    user: {
      email: user.email,
      name: user.name || "",
      birthDate: dateInputValue(user.birthDate),
    },
  });
}

export async function PATCH(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim().slice(0, 100) || null;
    const birthDate = parseBirthDate(body.birthDate);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name, birthDate },
      select: { email: true, name: true, birthDate: true },
    });

    return NextResponse.json({
      ok: true,
      user: {
        email: user.email,
        name: user.name || "",
        birthDate: dateInputValue(user.birthDate),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron guardar los cambios.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
