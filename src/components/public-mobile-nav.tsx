"use client";

import Link from "next/link";
import { BarChart3, CircleUserRound, House, Medal, ScrollText } from "lucide-react";
import { usePathname } from "next/navigation";
import { usePublicAuthState } from "@/components/use-public-auth-state";
import { resolveAuthenticatedLandingPath } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

const mobileLinks = [
  {
    href: "/",
    label: "Home",
    icon: House,
    isActive: (pathname: string) => pathname === "/",
  },
  {
    href: "/partidas-passadas",
    label: "Partidas",
    icon: ScrollText,
    isActive: (pathname: string) =>
      pathname === "/partidas-passadas" || pathname.startsWith("/partidas/"),
  },
  {
    href: "/votacao",
    label: "Votacao",
    icon: Medal,
    isActive: (pathname: string) => pathname === "/votacao",
  },
  {
    href: "/meu-perfil",
    label: "Perfil",
    icon: CircleUserRound,
    isActive: (pathname: string) => pathname === "/meu-perfil" || pathname.startsWith("/jogador"),
  },
  {
    href: "/estatisticas",
    label: "Stats",
    icon: BarChart3,
    isActive: (pathname: string) => pathname === "/estatisticas",
  },
];

export function PublicMobileNav() {
  const pathname = usePathname();
  const isAdminPath = pathname.startsWith("/admin");
  const { authState, isAuthenticated } = usePublicAuthState(!isAdminPath);

  if (isAdminPath) {
    return null;
  }

  function resolveHref(href: string) {
    if (href === "/" || href === "/estatisticas") {
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
    <nav className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-emerald-200/80 bg-white/96 shadow-[0_-8px_32px_-26px_rgba(11,47,31,0.55)] backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 px-2 pt-2">
        {mobileLinks.map((link) => {
          const active = link.isActive(pathname);
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={resolveHref(link.href)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition",
                active
                  ? "bg-emerald-950 text-white shadow-sm"
                  : "text-emerald-800 hover:bg-emerald-50",
              )}
            >
              <Icon className="size-4" />
              <span className="truncate">{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
