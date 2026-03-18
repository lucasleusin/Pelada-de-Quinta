"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type AuthState = {
  id: string;
  role: "ADMIN" | "PLAYER";
  status: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";
  name: string | null;
  nickname?: string | null;
  playerId?: string | null;
  mustChangePassword?: boolean;
};

export function usePublicAuthState(enabled = true) {
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setAuthState(null);
      setLoading(false);
      return;
    }

    let active = true;
    let requestId = 0;

    async function loadUser() {
      const currentRequestId = ++requestId;
      setLoading(true);

      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (!active || currentRequestId !== requestId) {
          return;
        }

        if (!response.ok) {
          setAuthState(null);
          return;
        }

        const data = (await response.json()) as AuthState;
        setAuthState(data);
      } catch {
        if (active && currentRequestId === requestId) {
          setAuthState(null);
        }
      } finally {
        if (active && currentRequestId === requestId) {
          setLoading(false);
        }
      }
    }

    void loadUser();

    function handleAuthStateChange() {
      void loadUser();
    }

    window.addEventListener("focus", handleAuthStateChange);
    window.addEventListener("auth-state-changed", handleAuthStateChange);

    return () => {
      active = false;
      window.removeEventListener("focus", handleAuthStateChange);
      window.removeEventListener("auth-state-changed", handleAuthStateChange);
    };
  }, [enabled, pathname]);

  return {
    authState,
    loading,
    isAuthenticated: Boolean(authState?.id),
  };
}
