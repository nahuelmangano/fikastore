import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isAdminRole, isStaffRole } from "@/lib/roles";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rutas que requieren login
  const protectedPaths = ["/checkout", "/account", "/admin"];
  const isProtected = protectedPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // No logueado
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin area
  if (pathname.startsWith("/admin")) {
    const role = (token as { role?: string } | null)?.role;

    // Solo admin puede gestionar alta/edición de staff.
    if (pathname === "/admin/users/new" || pathname.startsWith("/admin/users/new/")) {
      if (!isAdminRole(role)) {
        return NextResponse.redirect(new URL("/", req.url));
      }
      return NextResponse.next();
    }

    // Staff puede entrar al listado de usuarios.
    if (pathname === "/admin/users" || pathname.startsWith("/admin/users/")) {
      if (!isStaffRole(role)) {
        return NextResponse.redirect(new URL("/", req.url));
      }
      return NextResponse.next();
    }

    // merchant y admin pueden usar las secciones operativas del admin.
    if (!isStaffRole(role)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/checkout/:path*", "/account/:path*", "/admin/:path*"],
};
