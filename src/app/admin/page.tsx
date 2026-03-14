"use client";

import Link from "next/link";
import { HeroBlock, PageShell, SectionShell } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AdminHomePage() {
  return (
    <PageShell>
      <HeroBlock className="p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Central Operacional</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Painel administrativo</h2>
        <p className="text-sm text-emerald-800">Gerencie jogadores, partidas, times, placares e alertas internos.</p>
      </HeroBlock>

      <div className="grid gap-3 md:grid-cols-2">
        <Link href="/admin/jogadores" className="section-shell p-4 transition hover:border-emerald-400">
          <h3 className="text-xl font-semibold text-emerald-950">Jogadores</h3>
          <p className="text-sm text-emerald-800">Criar, editar e ativar/inativar.</p>
        </Link>

        <Link href="/admin/partidas" className="section-shell p-4 transition hover:border-emerald-400">
          <h3 className="text-xl font-semibold text-emerald-950">Partidas</h3>
          <p className="text-sm text-emerald-800">Datas, times, presencas e placar.</p>
        </Link>

        <Link href="/admin/cadastros" className="section-shell p-4 transition hover:border-emerald-400">
          <h3 className="text-xl font-semibold text-emerald-950">Cadastros</h3>
          <p className="text-sm text-emerald-800">Aprove, vincule ou rejeite novas contas de atletas.</p>
        </Link>

        <SectionShell className="p-4">
          <h3 className="text-xl font-semibold text-emerald-950">Relatorios</h3>
          <p className="text-sm text-emerald-800">Rankings, presenca e exportacao CSV consolidados.</p>
          <div className="mt-3">
            <Link href="/admin/relatorios" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full bg-white")}>
              Ir para relatorios
            </Link>
          </div>
        </SectionShell>

        <SectionShell className="p-4">
          <h3 className="text-xl font-semibold text-emerald-950">Whatsapp</h3>
          <p className="text-sm text-emerald-800">Destinatarios e historico dos alertas administrativos.</p>
          <div className="mt-3">
            <Link href="/admin/whatsapp" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full bg-white")}>
              Ir para Whatsapp
            </Link>
          </div>
        </SectionShell>
      </div>
    </PageShell>
  );
}
