import { redirect } from "next/navigation";

export default async function PosJogoRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/partidas-passadas?matchId=${encodeURIComponent(id)}`);
}
