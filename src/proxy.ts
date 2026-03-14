import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const athleteProtectedPaths = ["/partidas-passadas", "/votacao", "/meu-perfil"];

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  const isAdminLoginPath = pathname === "/admin/login";
  const isAthleteProtectedPath = athleteProtectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (isAdminPath && !isAdminLoginPath) {
    if (!request.auth?.user?.id) {
      return NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin));
    }

    if (request.auth.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/entrar", request.nextUrl.origin));
    }

    return NextResponse.next();
  }

  if (isAthleteProtectedPath && !request.auth?.user?.id) {
    const redirectUrl = new URL("/entrar", request.nextUrl.origin);
    redirectUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/partidas-passadas/:path*", "/votacao/:path*", "/meu-perfil/:path*"],
};
