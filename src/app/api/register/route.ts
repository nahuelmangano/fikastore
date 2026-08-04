import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";

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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");
    const name = body.name ? String(body.name).trim() : null;
    const birthDate = parseBirthDate(body.birthDate);

    if (!email || !password) {
      return NextResponse.json(
        { ok: false, error: "Email y password son obligatorios." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: "La contraseña debe tener al menos 6 caracteres." },
        { status: 400 }
      );
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json(
        { ok: false, error: "Ese email ya está registrado." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        birthDate,
        role: "customer",
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error creando usuario.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes("Fecha") ? 400 : 500 }
    );
  }
}
