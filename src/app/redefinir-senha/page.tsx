"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

export default function RedefinirSenhaPage() {
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Nao foi possivel redefinir a senha." }));
      setError(payload.error ?? "Nao foi possivel redefinir a senha.");
      return;
    }

    setMessage("Senha atualizada com sucesso. Agora voce ja pode entrar.");
    setPassword("");
  }

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-lg p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Redefinir senha</h2>
        <p className="text-sm text-emerald-800">Escolha uma nova senha para a sua conta.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label>
            <span className="field-label">Nova senha</span>
            <input className="field-input" type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
          </label>

          <Button className="w-full rounded-full" type="submit" disabled={loading || !token}>
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
