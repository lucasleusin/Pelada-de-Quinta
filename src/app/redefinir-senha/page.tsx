"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { resolveAuthenticatedLandingPath } from "@/lib/auth-redirect";

type CurrentUser = {
  status: "PENDING_VERIFICATION" | "PENDING_APPROVAL" | "ACTIVE" | "DISABLED" | "REJECTED";
  playerId: string | null;
  mustChangePassword: boolean;
};

export default function RedefinirSenhaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const forcedMode = useMemo(() => searchParams.get("modo") === "obrigatorio", [searchParams]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const response = await fetch(forcedMode ? "/api/auth/change-password" : "/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(forcedMode ? { password } : { token, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Nao foi possivel redefinir a senha." }));
      setError(payload.error ?? "Nao foi possivel redefinir a senha.");
      return;
    }

    setPassword("");

    if (forcedMode) {
      const meResponse = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });

      if (!meResponse.ok) {
        setMessage("Senha atualizada com sucesso. Entre novamente para continuar.");
        router.replace("/entrar");
        return;
      }

      const me = (await meResponse.json()) as CurrentUser;
      setMessage("Senha atualizada com sucesso.");
      router.replace(resolveAuthenticatedLandingPath({ ...me, mustChangePassword: false }));
      return;
    }

    setMessage("Senha atualizada com sucesso. Agora voce ja pode entrar.");
  }

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-lg p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Redefinir senha</h2>
        <p className="text-sm text-emerald-800">
          {forcedMode
            ? "Escolha uma nova senha para continuar usando sua conta."
            : "Escolha uma nova senha para a sua conta."}
        </p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label>
            <span className="field-label">Nova senha</span>
            <input className="field-input" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
          </label>

          <Button className="w-full rounded-full" type="submit" disabled={loading || (!forcedMode && !token)}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>

        <div className="mt-4 text-sm font-semibold text-emerald-700">
          <Link href="/entrar">Voltar para entrar</Link>
        </div>

        {message ? <StatusNote className="mt-4" tone="success">{message}</StatusNote> : null}
        {error ? <StatusNote className="mt-4" tone="error">{error}</StatusNote> : null}
      </HeroBlock>
    </PageShell>
  );
}
