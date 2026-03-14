"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuthState = {
  id: string;
  role: string;
  status: string;
  name: string | null;
  nickname?: string | null;
};

type PublicAuthButtonProps = {
  className?: string;
};

export function PublicAuthButton({ className }: PublicAuthButtonProps) {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUser() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (!active) {
          return;
        }

        if (!response.ok) {
          setAuthState(null);
          return;
        }

        const data = (await response.json()) as AuthState;
        setAuthState(data);
      } catch {
        if (active) {
          setAuthState(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    return () => {
      active = false;
    };
  }, []);

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
