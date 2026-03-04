"use client";

import { useEffect, useState } from "react";

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
      });
  }, []);

  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h2 className="text-3xl font-bold text-emerald-950">Relatorios</h2>
        <a href="/api/admin/reports/export.csv" className="btn btn-accent mt-3 inline-flex">
          Exportar CSV
        </a>
      </section>

      {leaderboards ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ReportCard title="Artilharia" rows={leaderboards.topScorers.slice(0, 10)} metric="goals" />
          <ReportCard title="Assistencias" rows={leaderboards.topAssists.slice(0, 10)} metric="assists" />
          <ReportCard title="Gols sofridos" rows={leaderboards.mostConceded.slice(0, 10)} metric="goalsConceded" />
          <ReportCard title="MVP" rows={leaderboards.mvp.slice(0, 10)} metric="averageRating" />
        </div>
      ) : (
        <p className="card p-4 text-sm text-emerald-900">Carregando liderancas...</p>
      )}

      <section className="card p-5">
        <h3 className="text-2xl font-bold text-emerald-950">Presenca</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {attendance.map((item) => (
            <li key={item.playerId} className="flex items-center justify-between rounded-xl border border-emerald-100 p-3">
              <span>{item.playerName}</span>
              <span>{item.attendancePercentage}%</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
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
    <section className="card p-4">
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
    </section>
  );
}
