"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("marcio");
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
      body: JSON.stringify({ username, password }),
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
    <section className="mx-auto max-w-md card p-6">
      <h2 className="text-3xl font-bold text-emerald-950">Login admin</h2>
      <p className="text-sm text-emerald-800">Acesso ao painel protegido.</p>

      <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
        <label>
          <span className="field-label">Usuario</span>
          <input
            className="field-input"
            type="text"
            required
            value={username}
            onChange={(event) => setUsername(event.currentTarget.value)}
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

        <button className="btn btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
