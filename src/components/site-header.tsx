"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/partidas-passadas", label: "Partidas Passadas" },
  { href: "/votacao", label: "Votacao" },
  { href: "/meu-perfil", label: "Meu Perfil" },
  { href: "/estatisticas", label: "Estatisticas" },
  { href: "/admin", label: "Admin" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-emerald-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-700 md:hidden">CH-RS - Pelada de Quinta</p>
          <div className="hidden md:block">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700">Cachoeira do Sul</p>
            <h1 className="font-heading text-2xl font-bold text-emerald-950">Pelada da Quinta</h1>
          </div>
        </Link>
        <nav className="flex w-full flex-wrap items-center justify-start gap-2 text-sm md:w-auto">
          {links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
                  "rounded-full",
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
