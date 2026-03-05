"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminLogoutButton } from "@/components/admin-logout-button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin" className="btn btn-ghost">
            Dashboard
          </Link>
          <Link href="/admin/jogadores" className="btn btn-ghost">
            Jogadores
          </Link>
          <Link href="/admin/partidas" className="btn btn-ghost">
            Partidas
          </Link>
        </div>
        <AdminLogoutButton />
      </div>
      {children}
    </div>
  );
}
