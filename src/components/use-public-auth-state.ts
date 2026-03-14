"use client";

import { useEffect, useState } from "react";

type AuthState = {
  id: string;
  role: string;
  status: string;
  name: string | null;
  nickname?: string | null;
};

export function usePublicAuthState(enabled = true) {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setAuthState(null);
      setLoading(false);
      return;
    }

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
  }, [enabled]);

  return {
    authState,
    loading,
    isAuthenticated: Boolean(authState?.id),
  };
}
