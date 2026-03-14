"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Nao foi possivel enviar o email." }));
      setError(payload.error ?? "Nao foi possivel enviar o email.");
      return;
    }

    setMessage("Se existir uma conta local com este email, enviaremos um link de redefinicao.");
  }

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-lg p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Esqueci a senha</h2>
        <p className="text-sm text-emerald-800">Informe seu email para receber um link de redefinicao.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label>
            <span className="field-label">Email</span>
            <input className="field-input" type="email" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
          </label>

          <Button className="w-full rounded-full" type="submit" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link"}
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
