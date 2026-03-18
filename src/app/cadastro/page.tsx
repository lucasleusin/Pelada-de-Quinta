"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { HeroBlock, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";

const positions = [
  { value: "", label: "Selecione..." },
  { value: "GOLEIRO", label: "Goleiro" },
  { value: "ZAGUEIRO", label: "Zagueiro" },
  { value: "MEIA", label: "Meia" },
  { value: "ATACANTE", label: "Atacante" },
  { value: "OUTRO", label: "Outro" },
] as const;

export default function CadastroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [position, setPosition] = useState("");
  const [shirtNumberPreference, setShirtNumberPreference] = useState("");
  const [whatsApp, setWhatsApp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        password,
        nickname: nickname.trim() || null,
        position: position || null,
        shirtNumberPreference: shirtNumberPreference ? Number(shirtNumberPreference) : null,
        whatsApp: whatsApp.trim() || null,
      }),
    });

    setLoading(false);

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Nao foi possivel criar a conta." }));
      setError(payload.error ?? "Nao foi possivel criar a conta.");
      return;
    }

    await signIn("credentials", {
      identifier: email,
      password,
      redirect: false,
      callbackUrl: "/conta",
    });

    router.refresh();
    setMessage("Cadastro criado. Verifique seu email para liberar o acesso e completar seu perfil.");
    setName("");
    setEmail("");
    setPassword("");
    setNickname("");
    setPosition("");
    setShirtNumberPreference("");
    setWhatsApp("");
  }

  return (
    <PageShell>
      <HeroBlock className="mx-auto w-full max-w-3xl p-6 sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Conta</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Cadastro do atleta</h2>
        <p className="text-sm text-emerald-800">Crie sua conta, confirme seu email e depois finalize seu perfil.</p>

        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <label className="md:col-span-2">
            <span className="field-label">Nome Completo</span>
            <input className="field-input" required value={name} onChange={(event) => setName(event.currentTarget.value)} />
          </label>

          <label>
            <span className="field-label">Email</span>
            <input className="field-input" type="email" required value={email} onChange={(event) => setEmail(event.currentTarget.value)} />
          </label>

          <label>
            <span className="field-label">Senha</span>
            <input className="field-input" type="password" required value={password} onChange={(event) => setPassword(event.currentTarget.value)} />
          </label>

          <label>
            <span className="field-label">Apelido</span>
            <input className="field-input" value={nickname} onChange={(event) => setNickname(event.currentTarget.value)} />
          </label>

          <label>
            <span className="field-label">Posicao</span>
            <select className="field-input" value={position} onChange={(event) => setPosition(event.currentTarget.value)}>
              {positions.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">Numero Preferido</span>
            <input className="field-input" type="number" min={0} max={99} value={shirtNumberPreference} onChange={(event) => setShirtNumberPreference(event.currentTarget.value)} />
          </label>

          <label>
            <span className="field-label">Whatsapp</span>
            <input className="field-input" type="tel" value={whatsApp} onChange={(event) => setWhatsApp(event.currentTarget.value)} />
          </label>

          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <Button className="rounded-full" type="submit" disabled={loading}>
              {loading ? "Criando conta..." : "Criar conta"}
            </Button>
            <Link href="/entrar" className="text-sm font-semibold text-emerald-700 hover:text-emerald-900">
              Ja tenho conta
            </Link>
          </div>
        </form>

        {message ? <StatusNote className="mt-4" tone="success">{message}</StatusNote> : null}
        {error ? <StatusNote className="mt-4" tone="error">{error}</StatusNote> : null}
      </HeroBlock>
    </PageShell>
  );
}
