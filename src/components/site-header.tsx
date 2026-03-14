"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PwaInstallMenu } from "@/components/pwa-install-menu";
import { PublicAuthButton } from "@/components/public-auth-button";
import { usePublicAuthState } from "@/components/use-public-auth-state";
import { useSiteSettings } from "@/components/site-settings-provider";
import { buttonVariants } from "@/components/ui/button";
import { resolveAuthenticatedLandingPath } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

const protectedHrefs = new Set(["/partidas-passadas", "/votacao", "/meu-perfil"]);

const publicLinks = [
  { href: "/", label: "Home" },
  { href: "/partidas-passadas", label: "Partidas Anteriores" },
  { href: "/votacao", label: "Votacao" },
  { href: "/meu-perfil", label: "Meu Perfil" },
  { href: "/estatisticas", label: "Estatisticas" },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const siteSettings = useSiteSettings();
  const logoUrl = siteSettings.logoUrl ?? undefined;
  const hasLogo = Boolean(logoUrl);
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const { authState, isAuthenticated } = usePublicAuthState(!isAdminPath);

  function resolveHref(href: string) {
    if (!protectedHrefs.has(href)) {
      return href;
    }

    if (authState?.id) {
      const landingPath = resolveAuthenticatedLandingPath(authState);
      return landingPath === "/meu-perfil" ? href : landingPath;
    }

    if (isAuthenticated) {
      return href;
    }

    return `/entrar?callbackUrl=${encodeURIComponent(href)}`;
  }

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-200/70 bg-white/85 backdrop-blur-lg">
      <div className="header-safe-zone mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <div className="flex items-center gap-3">
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt={siteSettings.siteName}
                  className="h-11 w-auto object-contain sm:h-14"
                />
              ) : (
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-emerald-700 sm:hidden">
                    {siteSettings.locationLabel || siteSettings.siteShortName}
                  </p>
                  <h1 className="font-heading text-2xl font-bold text-emerald-950 sm:text-3xl">
                    {siteSettings.siteName}
                  </h1>
                </div>
              )}
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {siteSettings.headerBadge ? (
              <p className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 md:block">
                {siteSettings.headerBadge}
              </p>
            ) : null}

            <div className="flex items-center gap-2 md:hidden">
              {isAdminPath ? (
                <Link
                  href="/"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "rounded-full bg-white",
                  )}
                >
                  Inicio
                </Link>
              ) : (
                <>
                  <PwaInstallMenu />
                  <PublicAuthButton />
                </>
              )}
            </div>
          </div>
        </div>

        <nav className="action-bar hidden w-full flex-wrap items-center gap-2 p-2 md:flex">
          {publicLinks.map((link) => {
            const active = isActivePath(pathname, link.href);

            return (
              <Link
                key={link.href}
                href={resolveHref(link.href)}
                className={cn(
                  buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
                  "rounded-full",
                  active ? "shadow-sm" : "bg-white",
                )}
              >
                {link.label}
              </Link>
            );
          })}

          <Link
            href="/admin"
            className={cn(
              buttonVariants({
                variant: pathname === "/admin" || pathname.startsWith("/admin/") ? "default" : "outline",
                size: "sm",
              }),
              "rounded-full",
              pathname === "/admin" || pathname.startsWith("/admin/") ? "shadow-sm" : "bg-white",
            )}
          >
            Admin
          </Link>

          {!isAdminPath ? <PublicAuthButton className="ml-auto" /> : null}
        </nav>
      </div>
    </header>
  );
}
