"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

export default function AdminLoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha no login." }));
      setError(payload.error ?? "Falha no login.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-lg p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Admin</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Login administrativo</h2>
        <p className="text-sm text-emerald-800">Acesso ao painel protegido.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label>
            <span className="field-label">Email ou usuario</span>
            <input
              className="field-input"
              type="text"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.currentTarget.value)}
            />
          </label>

          <label>
            <span className="field-label">Senha</span>
            <input className="field-input" type="password" required value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
          </label>

          <Button className="w-full rounded-full" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>

        <div className="mt-4 text-sm font-semibold text-emerald-700">
          <Link href="/entrar">Voltar para login geral</Link>
        </div>

        {error ? <StatusNote className="mt-4" tone="error">{error}</StatusNote> : null}
      </HeroBlock>
    </PageShell>
  );
}
