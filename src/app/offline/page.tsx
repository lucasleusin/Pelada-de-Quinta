import Link from "next/link";
import { HeroBlock, PageShell, SectionShell, StatusNote } from "@/components/layout/primitives";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function OfflinePage() {
  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Sem conexao</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Voce esta offline</h2>
        <p className="mt-2 text-sm text-emerald-800">
          O app consegue abrir algumas telas ja visitadas, mas atualizacoes e envios dependem de internet.
        </p>
      </HeroBlock>

      <SectionShell className="p-5">
        <div className="space-y-3">
          <StatusNote tone="warning">
            Confirmacoes, votos, uploads, placares e alteracoes administrativas precisam de conexao ativa.
          </StatusNote>
          <p className="text-sm text-emerald-900">
            Assim que a internet voltar, recarregue a tela ou volte para a Home para continuar usando normalmente.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={cn(buttonVariants({ variant: "default", size: "sm" }), "rounded-full")}>
              Ir para a Home
            </Link>
            <Link
              href="/partidas-passadas"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full bg-white")}
            >
              Ver ultimas partidas
            </Link>
          </div>
        </div>
      </SectionShell>
    </PageShell>
  );
}
