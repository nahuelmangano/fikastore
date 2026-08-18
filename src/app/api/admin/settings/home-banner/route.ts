import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isStaffRole } from "@/lib/roles";
import { getHomeBannerSettings, setHomeBannerSettings, type HomeBannerSlide } from "@/lib/storeSettings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const settings = await getHomeBannerSettings();
  return NextResponse.json({ ok: true, settings });
}

export async function PATCH(req: Request) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!isStaffRole(role)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const rawSlides = Array.isArray(body.slides) ? body.slides : [];
  const slides: HomeBannerSlide[] = [];
  const errors: string[] = [];

  for (const [idx, rawSlide] of rawSlides.entries()) {
    if (!rawSlide || typeof rawSlide !== "object") {
      errors.push(`Slide ${idx + 1}: datos invalidos.`);
      continue;
    }

    const input = rawSlide as Partial<HomeBannerSlide>;
    const id = String(input.id || crypto.randomUUID()).trim();
    const imageUrl = String(input.imageUrl || "").trim();
    const title = String(input.title || "").trim();
    const subtitle = String(input.subtitle || "").trim();
    const href = String(input.href || "").trim();

    if (!imageUrl) {
      errors.push(`Slide ${idx + 1}: falta subir una imagen.`);
      continue;
    }

    slides.push({
      id,
      imageUrl,
      title: title.slice(0, 90),
      subtitle: subtitle.slice(0, 120),
      href: href.slice(0, 240),
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join(" ") }, { status: 400 });
  }

  const settings = {
    enabled: body.enabled === true,
    slides,
  };
  await setHomeBannerSettings(settings);

  return NextResponse.json({ ok: true, settings });
}
