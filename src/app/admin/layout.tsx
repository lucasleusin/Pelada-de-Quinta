"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ActionBar, PageShell } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminLinks = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/partidas", label: "Partidas" },
  { href: "/admin/jogadores", label: "Jogadores" },
  { href: "/admin/cadastros", label: "Cadastros" },
  { href: "/admin/site-setup", label: "Site Setup" },
  { href: "/admin/whatsapp", label: "Whatsapp" },
  { href: "/admin/relatorios", label: "Relatorios" },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  function navClass(href: string) {
    const active = href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

    return cn(
      buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
      "rounded-full",
      active
        ? "shadow-sm"
        : "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100 hover:text-emerald-950",
    );
  }

  return (
    <PageShell>
      <ActionBar className="flex flex-col gap-3 border-emerald-300/80 bg-emerald-200/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {adminLinks.map((link) => (
            <Link key={link.href} href={link.href} className={cn(navClass(link.href), "shrink-0")}>
              {link.label}
            </Link>
          ))}
        </div>
        <AdminLogoutButton />
      </ActionBar>
      {children}
    </PageShell>
  );
}
