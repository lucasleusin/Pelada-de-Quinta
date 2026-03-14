"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/entrar?callbackUrl=%2Fadmin");
    router.refresh();
  }

  return (
    <Button className="rounded-full" onClick={handleLogout} type="button" variant="outline" size="sm">
      Sair
    </Button>
  );
}
