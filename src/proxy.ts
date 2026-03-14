import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessAdminArea, isAccountReadyForPlayerArea, resolveAuthenticatedLandingPath } from "@/lib/auth-redirect";

const athleteProtectedPaths = ["/partidas-passadas", "/votacao", "/meu-perfil"];

export default auth((request) => {
  const pathname = request.nextUrl.pathname;
  const isAdminPath = pathname.startsWith("/admin");
  const isAdminLoginPath = pathname === "/admin/login";
  const isAccountPath = pathname === "/conta" || pathname.startsWith("/conta/");
  const isForcedPasswordPath = pathname === "/redefinir-senha" && request.nextUrl.searchParams.get("modo") === "obrigatorio";
  const isAthleteProtectedPath = athleteProtectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const user = request.auth?.user;

  if (isAdminPath && !isAdminLoginPath) {
    if (!user?.id) {
      const redirectUrl = new URL("/entrar", request.nextUrl.origin);
      redirectUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (!canAccessAdminArea(user)) {
      const redirectUrl = new URL(resolveAuthenticatedLandingPath(user), request.nextUrl.origin);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  if (isForcedPasswordPath) {
    if (!user?.id) {
      const redirectUrl = new URL("/entrar", request.nextUrl.origin);
      redirectUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return NextResponse.next();
  }

  if (isAccountPath) {
    if (!user?.id) {
      const redirectUrl = new URL("/entrar", request.nextUrl.origin);
      redirectUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (user.mustChangePassword) {
      return NextResponse.redirect(new URL("/redefinir-senha?modo=obrigatorio", request.nextUrl.origin));
    }

    if (isAccountReadyForPlayerArea(user)) {
      return NextResponse.redirect(new URL("/meu-perfil", request.nextUrl.origin));
    }

    return NextResponse.next();
  }

  if (isAthleteProtectedPath && !user?.id) {
    const redirectUrl = new URL("/entrar", request.nextUrl.origin);
    redirectUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAthleteProtectedPath && user?.id) {
    if (user.mustChangePassword) {
      return NextResponse.redirect(new URL("/redefinir-senha?modo=obrigatorio", request.nextUrl.origin));
    }

    if (!isAccountReadyForPlayerArea(user)) {
      return NextResponse.redirect(new URL("/conta", request.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*", "/conta/:path*", "/partidas-passadas/:path*", "/votacao/:path*", "/meu-perfil/:path*"],
};
