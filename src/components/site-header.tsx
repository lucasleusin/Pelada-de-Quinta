"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSiteSettings } from "@/components/site-settings-provider";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/partidas-passadas", label: "Partidas Anteriores" },
  { href: "/votacao", label: "Votacao" },
  { href: "/meu-perfil", label: "Meu Perfil" },
  { href: "/estatisticas", label: "Estatisticas" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const siteSettings = useSiteSettings();

  return (
    <header className="sticky top-0 z-30 border-b border-emerald-200/70 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-4 py-3 sm:px-5 lg:px-8">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="rounded-lg px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
            <div className="flex items-center gap-3">
              {siteSettings.logoUrl ? (
                <img
                  src={siteSettings.logoUrl}
                  alt=""
                  className="h-11 w-11 rounded-xl border border-emerald-200 bg-white object-contain p-1"
                />
              ) : null}

              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700 sm:hidden">
                  {siteSettings.siteShortName}
                </p>
                <div className="hidden sm:block">
                  {siteSettings.locationLabel ? (
                    <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-700">
                      {siteSettings.locationLabel}
                    </p>
                  ) : null}
                  <h1 className="font-heading text-2xl font-bold text-emerald-950">{siteSettings.siteName}</h1>
                </div>
              </div>
            </div>
          </Link>

          {siteSettings.headerBadge ? (
            <p className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-emerald-700 md:block">
              {siteSettings.headerBadge}
            </p>
          ) : null}
        </div>

        <nav className="action-bar flex w-full flex-wrap items-center gap-2 p-2">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
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
        </nav>
      </div>
    </header>
  );
}
