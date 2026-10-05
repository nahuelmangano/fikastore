import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "./ui";

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function ProfilePage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect("/login?next=/account/profile");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true, birthDate: true },
  });
  if (!user) redirect("/login?next=/account/profile");

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
            <p className="mt-2 text-sm text-zinc-400">Editá tus datos personales y tu fecha de nacimiento.</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/account/orders" className="text-zinc-400 hover:text-zinc-200">
              Mis pedidos
            </Link>
            <Link href="/" className="text-zinc-400 hover:text-zinc-200">
              Volver a la tienda
            </Link>
          </div>
        </div>

        <ProfileForm
          initialName={user.name || ""}
          email={user.email}
          initialBirthDate={dateInputValue(user.birthDate)}
        />
      </div>
    </main>
  );
}
