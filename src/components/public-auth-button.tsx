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
  );
}
