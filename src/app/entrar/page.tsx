"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

const rememberedIdentifierKey = "pelada:remembered-login";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.3-.2-2H12Z" />
      <path fill="#34A853" d="M2 12c0 5.5 4.5 10 10 10 5 0 8.3-3.3 9.3-7.9h-3.8c-.7 2-2.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6 0-1 .3-1.9.7-2.8L3.6 6.7C2.6 8.2 2 10 2 12Z" />
      <path fill="#4A90E2" d="M21.6 12.2c0-.7-.1-1.3-.2-2H12v3.9h5.5c-.3 1.4-1.1 2.6-2.3 3.4l3.5 2.7c2.1-2 2.9-4.9 2.9-8Z" />
      <path fill="#FBBC05" d="M6.7 9.1C7.2 7.2 9.4 5.8 12 5.8c1.9 0 3.2.8 3.9 1.5l2.7-2.6C16.9 3 14.7 2 12 2 8.1 2 4.7 4.2 3 7.5l3.7 1.6Z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}

export default function EntrarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return window.localStorage.getItem(rememberedIdentifierKey) ?? "";
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return Boolean(window.localStorage.getItem(rememberedIdentifierKey));
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const callbackUrl = useMemo(() => searchParams.get("callbackUrl") || "/meu-perfil", [searchParams]);
  const rejected = searchParams.get("erro") === "rejeitado";
  const removed = searchParams.get("erro") === "removido";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (rememberMe) {
      window.localStorage.setItem(rememberedIdentifierKey, identifier);
    } else {
      window.localStorage.removeItem(rememberedIdentifierKey);
    }

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

    window.dispatchEvent(new Event("auth-state-changed"));
    router.refresh();
    window.location.assign(result.url || callbackUrl);
  }

  async function handleSocialSignIn(provider: "google" | "microsoft-entra-id") {
    setLoading(true);
    await signIn(provider, { callbackUrl });
  }

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-xl border border-emerald-100/80 bg-white/95 p-6 shadow-[0_32px_90px_-48px_rgba(10,61,38,0.55)] sm:p-8">
        <div className="mx-auto max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
          <h2 className="mt-1 text-3xl font-bold text-emerald-950 sm:text-[2.15rem]">Entre com sua conta</h2>
          <p className="mt-2 text-sm text-emerald-800">Use Google, Microsoft ou seu email e senha.</p>

          <div className="mt-6 grid gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start rounded-2xl border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-950 hover:bg-emerald-50"
              disabled={loading}
              onClick={() => handleSocialSignIn("google")}
            >
              <GoogleIcon />
              Continue com Google
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-12 justify-start rounded-2xl border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-950 hover:bg-emerald-50"
              disabled={loading}
              onClick={() => handleSocialSignIn("microsoft-entra-id")}
            >
              <MicrosoftIcon />
              Continue com Microsoft
            </Button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-emerald-100" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">OU</span>
            <div className="h-px flex-1 bg-emerald-100" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
          <label>
            <span className="field-label">Email</span>
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
            <input
              className="field-input"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>

            <label className="flex items-center gap-3 text-sm font-medium text-emerald-900">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.currentTarget.checked)}
                className="size-4 rounded border border-emerald-300 text-emerald-700 focus:ring-emerald-500"
              />
              Lembrar de mim
            </label>

            <Button className="h-11 w-full rounded-2xl" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="mt-5 space-y-2 text-sm text-emerald-800">
            <p>
              Esqueceu a senha?{" "}
              <Link href="/esqueci-a-senha" className="font-semibold text-emerald-700 hover:text-emerald-900">
                Clique aqui.
              </Link>
            </p>
            <p>
              Nao tem uma conta ainda?{" "}
              <Link href="/cadastro" className="font-semibold text-emerald-700 hover:text-emerald-900">
                Registre-se aqui.
              </Link>
            </p>
          </div>

          {rejected ? <StatusNote className="mt-4" tone="error">Seu cadastro foi rejeitado. Fale com o administrador.</StatusNote> : null}
          {removed ? <StatusNote className="mt-4" tone="error">Seu acesso foi removido. Fale com o administrador.</StatusNote> : null}
          {error ? <StatusNote className="mt-4" tone="error">{error}</StatusNote> : null}
        </div>
      </HeroBlock>
    </PageShell>
  );
}
