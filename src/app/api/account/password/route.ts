import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function currentUserId(session: Awaited<ReturnType<typeof auth>>) {
  return (session?.user as { id?: string } | undefined)?.id;
}

export async function POST(req: Request) {
  const userId = currentUserId(await auth());
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Completá todos los campos." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ ok: false, error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ ok: false, error: "Las contraseñas nuevas no coinciden." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return NextResponse.json({ ok: false, error: "La contraseña actual es incorrecta." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo cambiar la contraseña." }, { status: 500 });
  }
}
