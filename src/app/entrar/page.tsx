"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

export default function EntrarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const callbackUrl = useMemo(() => searchParams.get("callbackUrl") || "/meu-perfil", [searchParams]);
  const rejected = searchParams.get("erro") === "rejeitado";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      identifier,
      password,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (!result || result.error) {
      setError("Credenciais invalidas.");
      return;
    }

    router.push(result.url || callbackUrl);
    router.refresh();
  }

  async function handleSocialSignIn(provider: "google" | "microsoft-entra-id") {
    setLoading(true);
    await signIn(provider, { callbackUrl });
  }

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-lg p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Entrar</h2>
        <p className="text-sm text-emerald-800">Acesse sua conta de atleta ou admin.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <label>
            <span className="field-label">Email</span>
            <input
              className="field-input"
              type="email"
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.currentTarget.value)}
            />
          </label>

          <label>
            <span className="field-label">Senha</span>
            <input
              className="field-input"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>

          <Button className="w-full rounded-full" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar com email e senha"}
          </Button>
        </form>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" className="rounded-full" disabled={loading} onClick={() => handleSocialSignIn("google")}>
            Entrar com Google
          </Button>
          <Button type="button" variant="outline" className="rounded-full" disabled={loading} onClick={() => handleSocialSignIn("microsoft-entra-id")}>
            Entrar com Microsoft
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-sm text-emerald-800">
          <Link href="/cadastro" className="font-semibold text-emerald-700 hover:text-emerald-900">
            Criar conta
          </Link>
          <Link href="/esqueci-a-senha" className="font-semibold text-emerald-700 hover:text-emerald-900">
            Esqueci a senha
          </Link>
          <Link href="/admin/login" className="font-semibold text-emerald-700 hover:text-emerald-900">
            Entrar como admin
          </Link>
        </div>

        {rejected ? <StatusNote className="mt-4" tone="error">Seu cadastro foi rejeitado. Fale com o administrador.</StatusNote> : null}
        {error ? <StatusNote className="mt-4" tone="error">{error}</StatusNote> : null}
      </HeroBlock>
    </PageShell>
  );
}
