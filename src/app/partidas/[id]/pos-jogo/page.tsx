"use client";

import { useEffect, useMemo, useState } from "react";
import {
  HeroBlock,
  PageShell,
  SectionShell,
  StatusNote,
} from "@/components/layout/primitives";
import { StarRating } from "@/components/star-rating";
import { Button } from "@/components/ui/button";
import { hasTeam, type TeamCode, type TeamSplitStats } from "@/lib/team-utils";

type Participant = {
  playerId: string;
  player: { id: string; name: string };
  teams: TeamCode[];
  teamAGoals: number;
  teamAAssists: number;
  teamAGoalsConceded: number;
  teamBGoals: number;
  teamBAssists: number;
  teamBGoalsConceded: number;
  goals: number;
  assists: number;
  goalsConceded: number;
  playedAsGoalkeeper: boolean;
};

type MatchPayload = {
  id: string;
  status: string;
  participants: Participant[];
};

export default function PosJogoPage({ params }: { params: { id: string } }) {
  const [match, setMatch] = useState<MatchPayload | null>(null);
  const [stats, setStats] = useState<Record<string, TeamSplitStats>>({});
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    fetch(`/api/matches/${params.id}`)
      .then((res) => res.json())
      .then((data: MatchPayload) => {
        setMatch(data);
        const initialStats: Record<string, TeamSplitStats> = {};
        for (const participant of data.participants) {
          initialStats[participant.playerId] = {
            teamAGoals: participant.teamAGoals,
            teamAAssists: participant.teamAAssists,
            teamAGoalsConceded: participant.teamAGoalsConceded,
            teamBGoals: participant.teamBGoals,
            teamBAssists: participant.teamBAssists,
            teamBGoalsConceded: participant.teamBGoalsConceded,
          };
        }
        setStats(initialStats);
      })
      .catch(() => setMessage("Falha ao carregar partida."));
  }, [params.id]);

  const currentPlayerId = useMemo(
    () => (typeof window !== "undefined" ? localStorage.getItem("pelada:selectedPlayerId") : null),
    [],
  );

  const participants = useMemo(() => match?.participants ?? [], [match]);
  const statRows = useMemo(
    () =>
      participants.flatMap((participant) =>
        (["A", "B"] as const)
          .filter((team) => hasTeam(participant.teams, team))
          .map((team) => ({ participant, team })),
      ),
    [participants],
  );

  function getTeamFieldNames(team: TeamCode) {
    if (team === "A") {
      return {
        goals: "teamAGoals" as const,
        assists: "teamAAssists" as const,
        goalsConceded: "teamAGoalsConceded" as const,
      };
    }

    return {
      goals: "teamBGoals" as const,
      assists: "teamBAssists" as const,
      goalsConceded: "teamBGoalsConceded" as const,
    };
  }

  function updateStat(playerId: string, field: keyof TeamSplitStats, value: number) {
    setStats((prev) => ({
      ...prev,
      [playerId]: {
        teamAGoals: prev[playerId]?.teamAGoals ?? 0,
        teamAAssists: prev[playerId]?.teamAAssists ?? 0,
        teamAGoalsConceded: prev[playerId]?.teamAGoalsConceded ?? 0,
        teamBGoals: prev[playerId]?.teamBGoals ?? 0,
        teamBAssists: prev[playerId]?.teamBAssists ?? 0,
        teamBGoalsConceded: prev[playerId]?.teamBGoalsConceded ?? 0,
        [field]: Number.isNaN(value) ? 0 : Math.max(0, value),
      },
    }));
  }

  async function saveStats() {
    if (!match) return;

    const payload = {
      createdByPlayerId: currentPlayerId ?? undefined,
      stats: participants.map((participant) => ({
        playerId: participant.playerId,
        teamAGoals: stats[participant.playerId]?.teamAGoals ?? 0,
        teamAAssists: stats[participant.playerId]?.teamAAssists ?? 0,
        teamAGoalsConceded: stats[participant.playerId]?.teamAGoalsConceded ?? 0,
        teamBGoals: stats[participant.playerId]?.teamBGoals ?? 0,
        teamBAssists: stats[participant.playerId]?.teamBAssists ?? 0,
        teamBGoalsConceded: stats[participant.playerId]?.teamBGoalsConceded ?? 0,
      })),
    };

    const response = await fetch(`/api/matches/${match.id}/stats`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => ({ error: "Erro ao salvar estatisticas." }));
      setMessage(payloadError.error ?? "Erro ao salvar estatisticas.");
      return;
    }

    setMessage("Estatisticas salvas.");
  }

  async function saveRatings() {
    if (!match || !currentPlayerId) {
      setMessage("Selecione seu jogador para avaliar.");
      return;
    }

    const payload = {
      ratings: Object.entries(ratings).map(([ratedPlayerId, rating]) => ({
        raterPlayerId: currentPlayerId,
        ratedPlayerId,
        rating,
      })),
    };

    if (payload.ratings.length === 0) {
      setMessage("Preencha ao menos uma nota.");
      return;
    }

    const response = await fetch(`/api/matches/${match.id}/ratings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const payloadError = await response.json().catch(() => ({ error: "Erro ao salvar avaliacoes." }));
      setMessage(payloadError.error ?? "Erro ao salvar avaliacoes.");
      return;
    }

    setMessage("Avaliacoes salvas.");
  }

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Fechamento</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Pos-jogo</h2>
        <p className="text-sm text-emerald-800">Registre gols, assistencias, gols sofridos e notas.</p>
      </HeroBlock>

      <SectionShell className="overflow-x-auto p-4">
        <table className="min-w-[36rem] text-sm">
          <thead>
            <tr className="text-left text-emerald-900">
              <th className="p-2">Jogador</th>
              <th className="p-2">Time</th>
              <th className="p-2">Gols</th>
              <th className="p-2">Assist.</th>
              <th className="p-2">Gols sofridos</th>
            </tr>
          </thead>
          <tbody>
            {statRows.map(({ participant, team }) => {
              const fields = getTeamFieldNames(team);

              return (
              <tr key={`${participant.playerId}-${team}`} className="border-t border-emerald-100">
                <td className="p-2 font-medium">{participant.player.name}</td>
                <td className="p-2">{team}</td>
                <td className="p-2">
                  <input
                    className="field-input max-w-20"
                    type="number"
                    min={0}
                    value={stats[participant.playerId]?.[fields.goals] ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, fields.goals, Number(event.currentTarget.value))
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input max-w-20"
                    type="number"
                    min={0}
                    value={stats[participant.playerId]?.[fields.assists] ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, fields.assists, Number(event.currentTarget.value))
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    className="field-input max-w-20"
                    type="number"
                    min={0}
                    value={stats[participant.playerId]?.[fields.goalsConceded] ?? 0}
                    onChange={(event) =>
                      updateStat(participant.playerId, fields.goalsConceded, Number(event.currentTarget.value))
                    }
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        <Button className="mt-4 w-full rounded-full sm:w-auto" onClick={saveStats}>
          Salvar estatisticas
        </Button>
      </SectionShell>

      <SectionShell className="p-5">
        <h3 className="text-2xl font-bold text-emerald-950">Avaliacoes (1..5)</h3>
        <div className="mt-4 space-y-3">
          {participants
            .filter((participant) => participant.playerId !== currentPlayerId)
            .map((participant) => (
              <div
                key={participant.playerId}
                className="flex flex-col gap-2 rounded-xl border border-emerald-100 bg-white p-3 md:flex-row md:items-center md:justify-between"
              >
                <span className="font-medium text-emerald-900">{participant.player.name}</span>
                <StarRating
                  value={ratings[participant.playerId] ?? 0}
                  onChange={(value) =>
                    setRatings((prev) => ({
                      ...prev,
                      [participant.playerId]: value,
                    }))
                  }
                />
              </div>
            ))}
        </div>

        <Button className="mt-4 w-full rounded-full sm:w-auto" variant="outline" onClick={saveRatings}>
          Salvar avaliacoes
        </Button>
      </SectionShell>

      {message ? <StatusNote tone="neutral">{message}</StatusNote> : null}
    </PageShell>
  );
}
