"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";

export default function VerificarEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [message, setMessage] = useState(token ? "Validando token..." : "Token de verificacao ausente.");

  useEffect(() => {
    if (!token) {
      return;
    }

    void (async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({ error: "Token invalido ou expirado." }));
          throw new Error(payload.error ?? "Token invalido ou expirado.");
        }

        setStatus("success");
        setMessage("Email confirmado. Redirecionando para o seu perfil...");
        window.dispatchEvent(new Event("auth-state-changed"));
        router.replace("/meu-perfil");
      } catch (error) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Nao foi possivel validar o token.");
      }
    })();
  }, [router, token]);

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-lg p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Verificacao de email</h2>
        <StatusNote className="mt-4" tone={status === "success" ? "success" : status === "error" ? "error" : "warning"}>
          {message}
        </StatusNote>
        {status !== "success" ? (
          <div className="mt-4 text-sm font-semibold text-emerald-700">
            <Link href="/entrar">Voltar para entrar</Link>
          </div>
        ) : null}
      </HeroBlock>
    </PageShell>
  );
}
