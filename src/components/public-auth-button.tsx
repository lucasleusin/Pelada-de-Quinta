"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { usePublicAuthState } from "@/components/use-public-auth-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PublicAuthButtonProps = {
  className?: string;
};

export function PublicAuthButton({ className }: PublicAuthButtonProps) {
  const { authState, loading } = usePublicAuthState();
  const [signingOut, setSigningOut] = useState(false);

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
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("rounded-full bg-white", className)}
      disabled={signingOut}
      onClick={async () => {
        setSigningOut(true);
        await signOut({ redirectTo: "/entrar" });
      }}
    >
      {signingOut ? "Saindo..." : "Sair"}
    </Button>
  );
}
