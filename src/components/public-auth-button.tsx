"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { usePublicAuthState } from "@/components/use-public-auth-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicAuthButtonProps = {
  className?: string;
};

export function PublicAuthButton({ className }: PublicAuthButtonProps) {
  const router = useRouter();
  const { authState, loading } = usePublicAuthState();
  const [signingOut, setSigningOut] = useState(false);
  const displayName =
    authState?.playerNickname?.trim() ||
    authState?.playerName?.trim() ||
    authState?.nickname?.trim() ||
    authState?.name?.trim() ||
    "atleta";

  if (loading) {
    return null;
  }

  if (!authState) {
    return (
      <Link href="/entrar" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full bg-white", className)}>
        Entrar
      </Link>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm font-medium text-emerald-900">Bem-vindo {displayName}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-white"
        disabled={signingOut}
        onClick={async () => {
          try {
            setSigningOut(true);
            const result = await signOut({
              redirect: false,
              callbackUrl: "/entrar",
            });

            window.dispatchEvent(new Event("auth-state-changed"));
            router.refresh();
            window.location.assign(result?.url ?? "/entrar");
          } finally {
            setSigningOut(false);
          }
        }}
      >
        {signingOut ? "Saindo..." : "Sair"}
      </Button>
    </div>
  );
}
