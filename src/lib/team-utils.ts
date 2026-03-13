export const TEAM_CODES = ["A", "B"] as const;

export type TeamCode = (typeof TEAM_CODES)[number];

export type TeamSplitStats = {
  teamAGoals: number;
  teamAAssists: number;
  teamAGoalsConceded: number;
  teamBGoals: number;
  teamBAssists: number;
  teamBGoalsConceded: number;
};

export function normalizeTeams(input: readonly (string | null | undefined)[] | null | undefined): TeamCode[] {
  const unique = new Set<TeamCode>();

  for (const team of input ?? []) {
    if (team === "A" || team === "B") {
      unique.add(team);
    }
  }

  return TEAM_CODES.filter((team) => unique.has(team));
}

export function hasTeam(input: readonly (string | null | undefined)[] | null | undefined, team: TeamCode) {
  return normalizeTeams(input).includes(team);
}

export function getPrimaryTeam(
  primaryTeam: string | null | undefined,
  teamsInput: readonly (string | null | undefined)[] | null | undefined,
) {
  const teams = normalizeTeams(teamsInput);

  if (primaryTeam === "A" || primaryTeam === "B") {
    if (teams.includes(primaryTeam)) {
      return primaryTeam;
    }
  }

  return teams[0] ?? null;
}

export function resolveNextPrimaryTeam(
  teamsInput: readonly (string | null | undefined)[] | null | undefined,
  nextPrimaryTeam?: string | null,
  currentPrimaryTeam?: string | null,
  currentTeamsInput?: readonly (string | null | undefined)[] | null | undefined,
) {
  const teams = normalizeTeams(teamsInput);
  if (teams.length === 0) return null;

  if ((nextPrimaryTeam === "A" || nextPrimaryTeam === "B") && teams.includes(nextPrimaryTeam)) {
    return nextPrimaryTeam;
  }

  const currentEffectivePrimaryTeam = getPrimaryTeam(currentPrimaryTeam, currentTeamsInput);
  if (currentEffectivePrimaryTeam && teams.includes(currentEffectivePrimaryTeam)) {
    return currentEffectivePrimaryTeam;
  }

  return teams[0] ?? null;
}

export function emptyTeamSplitStats(): TeamSplitStats {
  return {
    teamAGoals: 0,
    teamAAssists: 0,
    teamAGoalsConceded: 0,
    teamBGoals: 0,
    teamBAssists: 0,
    teamBGoalsConceded: 0,
  };
}

export function clampNonNegativeInt(value: number) {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

export function sanitizeTeamSplitStats(
  stats: Partial<TeamSplitStats> | null | undefined,
  teams: readonly (string | null | undefined)[] | null | undefined,
): TeamSplitStats {
  const normalizedTeams = normalizeTeams(teams);
  const includeA = normalizedTeams.includes("A");
  const includeB = normalizedTeams.includes("B");

  return {
    teamAGoals: includeA ? clampNonNegativeInt(stats?.teamAGoals ?? 0) : 0,
    teamAAssists: includeA ? clampNonNegativeInt(stats?.teamAAssists ?? 0) : 0,
    teamAGoalsConceded: includeA ? clampNonNegativeInt(stats?.teamAGoalsConceded ?? 0) : 0,
    teamBGoals: includeB ? clampNonNegativeInt(stats?.teamBGoals ?? 0) : 0,
    teamBAssists: includeB ? clampNonNegativeInt(stats?.teamBAssists ?? 0) : 0,
    teamBGoalsConceded: includeB ? clampNonNegativeInt(stats?.teamBGoalsConceded ?? 0) : 0,
  };
}

export function sumTeamSplitStats(stats: TeamSplitStats) {
  return {
    goals: stats.teamAGoals + stats.teamBGoals,
    assists: stats.teamAAssists + stats.teamBAssists,
    goalsConceded: stats.teamAGoalsConceded + stats.teamBGoalsConceded,
  };
}

export function getTeamMembershipRank(input: readonly (string | null | undefined)[] | null | undefined) {
  const teams = normalizeTeams(input);

  if (teams.length === 0) return 0;
  if (teams.length === 1 && teams[0] === "A") return 1;
  if (teams.length === 1 && teams[0] === "B") return 2;
  return 3;
}

export function formatTeamsLabel(input: readonly (string | null | undefined)[] | null | undefined) {
  const teams = normalizeTeams(input);
  return teams.length > 0 ? teams.join("/") : "-";
}
