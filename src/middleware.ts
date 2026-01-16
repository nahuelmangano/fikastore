import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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

  // Admin-only
  if (pathname.startsWith("/admin")) {
    const role = (token as any).role;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/checkout/:path*", "/account/:path*", "/admin/:path*"],
};
