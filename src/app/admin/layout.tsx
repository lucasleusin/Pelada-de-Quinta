"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { ActionBar, PageShell } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  function navClass(href: string) {
    const active = pathname === href || pathname.startsWith(`${href}/`);

    return cn(
      buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
      "rounded-full",
      active ? "shadow-sm" : "bg-white",
    );
  }

  return (
    <PageShell>
      <ActionBar className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className={navClass("/admin")}>
            Dashboard
          </Link>
          <Link href="/admin/jogadores" className={navClass("/admin/jogadores")}>
            Jogadores
          </Link>
          <Link href="/admin/partidas" className={navClass("/admin/partidas")}>
            Partidas
          </Link>
          <Link href="/admin/relatorios" className={navClass("/admin/relatorios")}>
            Relatorios
          </Link>
        </div>
        <AdminLogoutButton />
      </ActionBar>
      {children}
    </PageShell>
  );
}
