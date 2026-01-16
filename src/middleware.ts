export { default } from "next-auth/middleware";

export const config = {
  matcher: ["/checkout", "/account/:path*", "/admin/:path*"],
};
