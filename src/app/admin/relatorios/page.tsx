"use client";

import { useEffect, useState } from "react";
import {
  HeroBlock,
  PageShell,
  SectionShell,
  StatusNote,
} from "@/components/layout/primitives";

type LeaderboardRow = {
  playerId: string;
  playerName: string;
  goals: number;
  assists: number;
  goalsConceded: number;
  averageRating: number;
  ratingsCount: number;
};

type Leaderboards = {
  topScorers: LeaderboardRow[];
  topAssists: LeaderboardRow[];
  mostConceded: LeaderboardRow[];
  mvp: LeaderboardRow[];
};

type AttendanceRow = {
  playerId: string;
  playerName: string;
  confirmed: number;
  eligibleMatches: number;
  attendancePercentage: number;
};

export default function AdminRelatoriosPage() {
  const [leaderboards, setLeaderboards] = useState<Leaderboards | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/admin/reports/leaderboards"), fetch("/api/admin/reports/attendance")])
      .then(async ([leaderboardsRes, attendanceRes]) => {
        const leaderboardPayload = (await leaderboardsRes.json()) as Leaderboards;
        const attendancePayload = (await attendanceRes.json()) as AttendanceRow[];
        setLeaderboards(leaderboardPayload);
        setAttendance(attendancePayload);
      })
      .catch(() => {
        setLeaderboards(null);
        setMessage("Falha ao carregar relatorios.");
      });
  }, []);

  return (
    <PageShell>
      <HeroBlock className="p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Admin</p>
        <h2 className="mt-1 text-3xl font-bold text-emerald-950">Relatorios</h2>
        <div className="mt-4">
          <a href="/api/admin/reports/export.csv" className="btn btn-accent inline-flex rounded-full">Exportar CSV</a>
        </div>
      </HeroBlock>

      {leaderboards ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ReportCard title="Artilharia" rows={leaderboards.topScorers.slice(0, 10)} metric="goals" />
          <ReportCard title="Assistencias" rows={leaderboards.topAssists.slice(0, 10)} metric="assists" />
          <ReportCard title="Gols sofridos" rows={leaderboards.mostConceded.slice(0, 10)} metric="goalsConceded" />
          <ReportCard title="MVP" rows={leaderboards.mvp.slice(0, 10)} metric="averageRating" />
        </div>
      ) : (
        <SectionShell className="p-4">
          <p className="text-sm text-emerald-900">Carregando liderancas...</p>
        </SectionShell>
      )}

      <SectionShell className="p-5">
        <h3 className="text-2xl font-bold text-emerald-950">Presenca</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {attendance.map((item) => (
            <li key={item.playerId} className="flex items-center justify-between rounded-xl border border-emerald-100 p-3">
              <span>{item.playerName}</span>
              <span>{item.attendancePercentage}%</span>
            </li>
          ))}
        </ul>
      </SectionShell>

      {message ? <StatusNote tone="error">{message}</StatusNote> : null}
    </PageShell>
  );
}

function ReportCard({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: LeaderboardRow[];
  metric: "goals" | "assists" | "goalsConceded" | "averageRating";
}) {
  return (
    <SectionShell className="p-4">
      <h4 className="text-xl font-semibold text-emerald-950">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm">
        {rows.map((row) => (
          <li key={row.playerId} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2">
            <span>{row.playerName}</span>
            <span className="font-semibold">
              {metric === "averageRating" ? row[metric].toFixed(2) : row[metric]}
            </span>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

