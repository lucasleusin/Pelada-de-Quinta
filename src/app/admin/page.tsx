import Link from "next/link";

export default function AdminHomePage() {
  return (
    <section className="space-y-4">
      <div className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Painel administrativo</h2>
        <p className="text-sm text-emerald-800">Gerencie jogadores, partidas, times, placares e relatorios.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/admin/jogadores" className="card p-4 hover:border-emerald-400">
          <h3 className="text-xl font-semibold text-emerald-950">Jogadores</h3>
          <p className="text-sm text-emerald-800">Criar, editar e ativar/inativar.</p>
        </Link>

        <Link href="/admin/partidas" className="card p-4 hover:border-emerald-400">
          <h3 className="text-xl font-semibold text-emerald-950">Partidas</h3>
          <p className="text-sm text-emerald-800">Status, times, presencas e placar.</p>
        </Link>

        <Link href="/admin/relatorios" className="card p-4 hover:border-emerald-400">
          <h3 className="text-xl font-semibold text-emerald-950">Relatorios</h3>
          <p className="text-sm text-emerald-800">Rankings, presenca e exportacao CSV.</p>
        </Link>
      </div>
    </section>
  );
}
