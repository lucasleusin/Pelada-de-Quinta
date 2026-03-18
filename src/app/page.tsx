"use client";

import {
  Check,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  RotateCcw,
  Sun,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDatePtBr, getDateSortValue } from "@/lib/date-format";
import { ActionBar, PageShell, StatusNote } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { usePublicAuthState } from "@/components/use-public-auth-state";
import { isAccountReadyForPlayerArea, resolveAuthenticatedLandingPath } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";
import type { IconKey } from "@/lib/weather-icons";

type Player = {
  id: string;
  name: string;
  nickname?: string | null;
  position: "GOLEIRO" | "ZAGUEIRO" | "MEIA" | "ATACANTE" | "OUTRO";
};

type PresenceStatus = "CONFIRMED" | "WAITLIST" | "CANCELED";

type Participant = {
  playerId: string;
  presenceStatus: PresenceStatus;
  teams: ("A" | "B")[];
  player: Player;
};

type Match = {
  id: string;
  matchDate: string;
  location: string | null;
  startTime: string;
  participants: Participant[];
};

type ListViewFilter = "ALL" | "PENDING" | "CONFIRMED" | "CANCELED";
type MatchCardVariant = "default" | "desktopSecondary" | "mobileSecondary";
type NextMatchWeather = { iconKey: IconKey; weatherCode: number; temperatureC: number };

function getTodayIsoDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().slice(0, 10);
}

function getPositionCode(position: Player["position"]) {
  if (position === "GOLEIRO") return "G";
  if (position === "ZAGUEIRO") return "Z";
  if (position === "MEIA") return "M";
  if (position === "ATACANTE") return "A";
  return "O";
}

function getPositionOrder(position: Player["position"]) {
  if (position === "GOLEIRO") return 0;
  if (position === "ZAGUEIRO") return 1;
  if (position === "MEIA") return 2;
  if (position === "ATACANTE") return 3;
  return 4;
}

function playerDisplayName(player: Player) {
  return player.nickname ?? player.name;
}

function formatPlayerLabel(player: Player) {
  return `${playerDisplayName(player)} (${getPositionCode(player.position)})`;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function ActionButton({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone: "green" | "red" | "yellow";
  onClick: () => void;
  children: ReactNode;
}) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-600 text-white hover:bg-emerald-700"
      : tone === "red"
        ? "bg-red-600 text-white hover:bg-red-700"
        : "bg-amber-400 text-white hover:bg-amber-500";

  return (
    <Button
      type="button"
      className={cn("h-10 w-10 rounded-full p-0", toneClass)}
      onClick={onClick}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function MatchSummaryCard({
  match,
  active,
  onClick,
  variant = "default",
}: {
  match: Match;
  active: boolean;
  onClick: () => void;
  variant?: MatchCardVariant;
}) {
  const isMobileSecondary = variant === "mobileSecondary";
  const isDesktopSecondary = variant === "desktopSecondary";
  const isDefault = variant === "default";
  const locationTextClass =
    "truncate uppercase text-emerald-700 text-[0.45rem] tracking-[0.08em] sm:text-[0.6rem]";
  const widthClass = isMobileSecondary
    ? "w-fit shrink-0 snap-start px-3 py-2"
    : isDesktopSecondary
      ? "w-full h-full min-w-0"
      : "w-fit min-w-0 px-3 py-2 sm:w-full";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${widthClass} rounded-xl border px-3 py-2 text-left transition ${
        active
          ? "border-emerald-700 bg-emerald-100"
          : "border-emerald-200 bg-white hover:border-emerald-400"
      }`}
    >
      <p
        className={`font-semibold text-emerald-950 ${
          isMobileSecondary ? "whitespace-nowrap text-sm leading-tight" : "text-sm sm:text-base"
        }`}
      >
        {formatDatePtBr(match.matchDate)}
        {isDefault ? ` - ${match.startTime}` : ""}
      </p>
      {isMobileSecondary ? null : (
        <p className={locationTextClass}>
          {match.location ? match.location : "Local a definir"}
        </p>
      )}
    </button>
  );
}

function WeatherIcon({ iconKey }: { iconKey: IconKey }) {
  const className = "h-5 w-5 text-emerald-800";

  if (iconKey === "SUN") return <Sun className={className} />;
  if (iconKey === "CLOUD_SUN") return <CloudSun className={className} />;
  if (iconKey === "FOG") return <CloudFog className={className} />;
  if (iconKey === "DRIZZLE") return <CloudDrizzle className={className} />;
  if (iconKey === "RAIN") return <CloudRain className={className} />;
  if (iconKey === "STORM") return <CloudLightning className={className} />;
  if (iconKey === "SNOW") return <CloudSnow className={className} />;
  return <Cloud className={className} />;
}

export default function HomePage() {
  const router = useRouter();
  const { authState, loading: authLoading } = usePublicAuthState();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [listViewFilter, setListViewFilter] = useState<ListViewFilter>("ALL");
  const [message, setMessage] = useState<string>("");
  const [actionMessage, setActionMessage] = useState<string>("");
  const [nextMatchWeather, setNextMatchWeather] = useState<NextMatchWeather | null>(null);
  const [quickPlayerId, setQuickPlayerId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem("pelada:selectedPlayerId") ?? "";
  });
  const [isLoadingData, setIsLoadingData] = useState(true);

  const isAuthenticatedPlayerHome = Boolean(authState?.id) && isAccountReadyForPlayerArea(authState ?? {});
  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId) ?? null,
    [matches, selectedMatchId],
  );
  const primaryMatch = useMemo(() => matches[0] ?? null, [matches]);
  const quickSelectedPresenceStatus = useMemo(
    () => selectedMatch?.participants.find((participant) => participant.playerId === quickPlayerId)?.presenceStatus ?? null,
    [quickPlayerId, selectedMatch],
  );
  const loggedPlayerPresenceStatus = authState?.playerId
    ? selectedMatch?.participants.find((participant) => participant.playerId === authState.playerId)?.presenceStatus ?? null
    : null;

  const otherMatches = useMemo(
    () => matches.slice(1),
    [matches],
  );

  const confirmed = useMemo(
    () =>
      [...(selectedMatch?.participants.filter((item) => item.presenceStatus === "CONFIRMED") ?? [])].sort((a, b) => {
        const byPosition = getPositionOrder(a.player.position) - getPositionOrder(b.player.position);
        if (byPosition !== 0) return byPosition;
        return playerDisplayName(a.player).localeCompare(playerDisplayName(b.player));
      }),
    [selectedMatch],
  );

  const canceled = useMemo(
    () =>
      [...(selectedMatch?.participants.filter((item) => item.presenceStatus === "CANCELED") ?? [])].sort((a, b) =>
        playerDisplayName(a.player).localeCompare(playerDisplayName(b.player)),
      ),
    [selectedMatch],
  );

  const pending = useMemo(() => {
    const statusByPlayer = new Map(
      selectedMatch?.participants.map((participant) => [participant.playerId, participant.presenceStatus]) ?? [],
    );

    return allPlayers.filter((player) => {
      const status = statusByPlayer.get(player.id);
      return status !== "CONFIRMED" && status !== "CANCELED";
    });
  }, [allPlayers, selectedMatch]);

  const normalizedSearchTerm = useMemo(() => normalizeText(searchTerm), [searchTerm]);

  const filteredPending = useMemo(
    () =>
      pending.filter((player) =>
        normalizedSearchTerm === "" ? true : normalizeText(playerDisplayName(player)).includes(normalizedSearchTerm),
      ),
    [normalizedSearchTerm, pending],
  );

  const filteredConfirmed = useMemo(
    () =>
      confirmed.filter((item) =>
        normalizedSearchTerm === "" ? true : normalizeText(playerDisplayName(item.player)).includes(normalizedSearchTerm),
      ),
    [confirmed, normalizedSearchTerm],
  );

  const filteredCanceled = useMemo(
    () =>
      canceled.filter((item) =>
        normalizedSearchTerm === "" ? true : normalizeText(playerDisplayName(item.player)).includes(normalizedSearchTerm),
      ),
    [canceled, normalizedSearchTerm],
  );

  const showPending = listViewFilter === "ALL" || listViewFilter === "PENDING";
  const showConfirmed = listViewFilter === "ALL" || listViewFilter === "CONFIRMED";
  const showCanceled = listViewFilter === "ALL" || listViewFilter === "CANCELED";

  async function loadPublicData() {
    const [playersRes, matchesRes] = await Promise.all([
      fetch("/api/players?active=true&publicSelectable=true", { cache: "no-store" }),
      fetch(`/api/matches?from=${getTodayIsoDate()}`, { cache: "no-store" }),
    ]);

    const players = ((await playersRes.json()) as Player[]).sort((a, b) =>
      playerDisplayName(a).localeCompare(playerDisplayName(b)),
    );
    const upcomingMatches = (await matchesRes.json()) as Match[];
    const sortedMatches = upcomingMatches.sort(
      (a, b) => getDateSortValue(a.matchDate) - getDateSortValue(b.matchDate),
    );

    setAllPlayers(players);
    setMatches(sortedMatches);

    setQuickPlayerId((current) => {
      const stored = window.localStorage.getItem("pelada:selectedPlayerId") ?? "";
      const candidate = current || stored;
      if (candidate && players.some((player) => player.id === candidate)) {
        return candidate;
      }
      if (candidate) {
        window.localStorage.removeItem("pelada:selectedPlayerId");
      }
      return "";
    });

    setSelectedMatchId((currentSelection) => {
      if (sortedMatches.length === 0) return null;
      if (currentSelection && sortedMatches.some((match) => match.id === currentSelection)) {
        return currentSelection;
      }
      return sortedMatches[0].id;
    });
  }

  useEffect(() => {
    if (!authLoading && authState?.id && !isAccountReadyForPlayerArea(authState)) {
      router.replace(resolveAuthenticatedLandingPath(authState));
      return;
    }

    async function loadAuthenticatedData() {
      const matchesRes = await fetch(`/api/matches?from=${getTodayIsoDate()}&playerId=me`, { cache: "no-store" });
      const upcomingMatches = (await matchesRes.json()) as Match[];
      const sortedMatches = upcomingMatches.sort(
        (a, b) => getDateSortValue(a.matchDate) - getDateSortValue(b.matchDate),
      );

      setAllPlayers([]);
      setMatches(sortedMatches);
      setSelectedMatchId((currentSelection) => {
        if (sortedMatches.length === 0) return null;
        if (currentSelection && sortedMatches.some((match) => match.id === currentSelection)) {
          return currentSelection;
        }
        return sortedMatches[0].id;
      });
    }

    async function synchronizeHomeData() {
      setIsLoadingData(true);
      setMessage("");

      try {
        const loader = !authLoading && isAuthenticatedPlayerHome ? loadAuthenticatedData : loadPublicData;
        await loader();
      } catch {
        setMessage("Falha ao carregar dados da home.");
      } finally {
        setIsLoadingData(false);
      }
    }

    void synchronizeHomeData();
  }, [authLoading, authState, isAuthenticatedPlayerHome, router]);

  useEffect(() => {
    if (!actionMessage) return;

    const timer = window.setTimeout(() => {
      setActionMessage("");
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [actionMessage]);


  useEffect(() => {
    if (!primaryMatch) return;

    let cancelled = false;

    const loadWeather = async () => {
      const matchDate = primaryMatch.matchDate.slice(0, 10);
      const startTime = primaryMatch.startTime || "19:00";
      const query = new URLSearchParams({ matchDate, startTime });

      try {
        const response = await fetch(`/api/weather/next-match?${query.toString()}`);
        if (!response.ok) {
          if (!cancelled) setNextMatchWeather(null);
          return;
        }

        const payload = (await response.json()) as NextMatchWeather;
        if (!cancelled && payload?.iconKey) {
          setNextMatchWeather(payload);
        } else if (!cancelled) {
          setNextMatchWeather(null);
        }
      } catch {
        if (!cancelled) setNextMatchWeather(null);
      }
    };

    loadWeather().catch(() => {
      if (!cancelled) setNextMatchWeather(null);
    });

    return () => {
      cancelled = true;
    };
  }, [primaryMatch]);

  function handleQuickPlayerSelect(playerId: string) {
    setQuickPlayerId(playerId);
    if (playerId) {
      window.localStorage.setItem("pelada:selectedPlayerId", playerId);
      return;
    }
    window.localStorage.removeItem("pelada:selectedPlayerId");
  }

  async function setPublicPresence(playerId: string, presenceStatus: PresenceStatus) {
    if (!selectedMatch) return;

    const response = await fetch(`/api/matches/${selectedMatch.id}/presence`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId, presenceStatus }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao atualizar presenca." }));
      setMessage(payload.error ?? "Falha ao atualizar presenca.");
      return;
    }

    setMessage("");
    if (presenceStatus === "CONFIRMED") {
      setActionMessage("Jogador confirmado.");
    } else if (presenceStatus === "CANCELED") {
      setActionMessage("Jogador desconfirmado.");
    } else {
      setActionMessage("Jogador voltou para pendentes.");
    }

    await loadPublicData();
  }

  async function setAuthenticatedPresence(presenceStatus: "CONFIRMED" | "CANCELED") {
    if (!selectedMatch || !isAuthenticatedPlayerHome) return;

    const response = await fetch(`/api/matches/${selectedMatch.id}/presence/me`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ presenceStatus }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ error: "Falha ao atualizar presenca." }));
      setMessage(payload.error ?? "Falha ao atualizar presenca.");
      return;
    }

    setMessage("");
    setActionMessage(
      presenceStatus === "CONFIRMED" ? "Sua presenca foi confirmada." : "Sua presenca foi desconfirmada.",
    );

    const matchesRes = await fetch(`/api/matches?from=${getTodayIsoDate()}&playerId=me`, { cache: "no-store" });
    const upcomingMatches = (await matchesRes.json()) as Match[];
    const sortedMatches = upcomingMatches.sort(
      (a, b) => getDateSortValue(a.matchDate) - getDateSortValue(b.matchDate),
    );
    setMatches(sortedMatches);
    setSelectedMatchId((currentSelection) => {
      if (sortedMatches.length === 0) return null;
      if (currentSelection && sortedMatches.some((match) => match.id === currentSelection)) {
        return currentSelection;
      }
      return sortedMatches[0].id;
    });
  }

  const welcomeName = authState?.nickname ?? authState?.name ?? "Atleta";

  return (
    <PageShell>
      <section className="hero-block p-4 sm:p-6">
        {isLoadingData ? (
          <p className="text-sm text-emerald-900">Carregando dados da home...</p>
        ) : matches.length === 0 || !primaryMatch ? (
          <>
            <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Proximas Partidas</p>
            <p className="mt-2 text-sm text-emerald-900">Nenhuma partida em aberto cadastrada.</p>
          </>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:hidden">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Proxima Partida</p>
                  {nextMatchWeather ? (
                    <span
                      className="inline-flex items-center gap-1"
                      aria-label={`Previsao do tempo da partida: ${nextMatchWeather.temperatureC} graus`}
                      title={`Previsao do tempo da partida: ${nextMatchWeather.temperatureC}C`}
                    >
                      <WeatherIcon iconKey={nextMatchWeather.iconKey} />
                      <span className="text-[10px] font-semibold leading-none text-emerald-800">
                        {nextMatchWeather.temperatureC}C
                      </span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  <MatchSummaryCard
                    match={primaryMatch}
                    active={selectedMatchId === primaryMatch.id}
                    onClick={() => setSelectedMatchId(primaryMatch.id)}
                  />
                </div>
              </div>

              {otherMatches.length > 0 ? (
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Outras Partidas</p>
                  <div className="mt-2 flex flex-col gap-2">
                    {otherMatches.slice(0, 2).map((match) => (
                      <MatchSummaryCard
                        key={match.id}
                        match={match}
                        active={selectedMatchId === match.id}
                        onClick={() => setSelectedMatchId(match.id)}
                        variant="mobileSecondary"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="hidden gap-4 md:grid xl:grid-cols-[minmax(280px,0.5fr)_minmax(0,1fr)]">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Proxima Partida</p>
                  {nextMatchWeather ? (
                    <span
                      className="inline-flex items-center gap-1"
                      aria-label={`Previsao do tempo da partida: ${nextMatchWeather.temperatureC} graus`}
                      title={`Previsao do tempo da partida: ${nextMatchWeather.temperatureC}C`}
                    >
                      <WeatherIcon iconKey={nextMatchWeather.iconKey} />
                      <span className="text-[10px] font-semibold leading-none text-emerald-800">
                        {nextMatchWeather.temperatureC}C
                      </span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-2">
                  <MatchSummaryCard
                    match={primaryMatch}
                    active={selectedMatchId === primaryMatch.id}
                    onClick={() => setSelectedMatchId(primaryMatch.id)}
                  />
                </div>
              </div>

              {otherMatches.length > 0 ? (
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-700">Outras Partidas</p>

                  <div className="mt-2 hidden grid-cols-2 gap-2 xl:grid">
                    {otherMatches.map((match) => (
                      <MatchSummaryCard
                        key={match.id}
                        match={match}
                        active={selectedMatchId === match.id}
                        onClick={() => setSelectedMatchId(match.id)}
                        variant="desktopSecondary"
                      />
                    ))}
                  </div>

                  <div className="mt-2 flex gap-2 overflow-x-auto pb-1 pr-1 xl:hidden">
                    {otherMatches.map((match) => (
                      <MatchSummaryCard
                        key={match.id}
                        match={match}
                        active={selectedMatchId === match.id}
                        onClick={() => setSelectedMatchId(match.id)}
                        variant="mobileSecondary"
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </section>
      {isAuthenticatedPlayerHome ? (
        <ActionBar className="space-y-3 p-3 sm:p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Confirmacao rapida</p>
            <p className="text-sm text-emerald-900">Bem-vindo {welcomeName}, voce ira jogar o proximo jogo?</p>
            <p className="mt-1 text-sm text-emerald-800">
              {loggedPlayerPresenceStatus === "CONFIRMED"
                ? "Voce ja confirmou sua presenca nesta partida."
                : loggedPlayerPresenceStatus === "CANCELED"
                  ? "Voce esta desconfirmado nesta partida."
                  : "Selecione a partida e escolha se voce vai jogar."}
            </p>
          </div>

          {selectedMatch ? (
            <div className="rounded-2xl border border-emerald-100 bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Partida selecionada</p>
              <p className="mt-2 text-lg font-semibold text-emerald-950">
                {formatDatePtBr(selectedMatch.matchDate)} - {selectedMatch.startTime}
              </p>
              <p className="text-sm text-emerald-800">{selectedMatch.location ?? "Local a definir"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  className="rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => setAuthenticatedPresence("CONFIRMED")}
                >
                  Confirmar
                </Button>
                <Button
                  type="button"
                  className="rounded-full bg-red-600 text-white hover:bg-red-700"
                  onClick={() => setAuthenticatedPresence("CANCELED")}
                >
                  Desconfirmar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-amber-700">Selecione uma partida para confirmar presenca.</p>
          )}
        </ActionBar>
      ) : (
        <ActionBar className="space-y-3 p-3 sm:p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Confirmacao rapida</p>
            <p className="text-sm text-emerald-900">
              {quickSelectedPresenceStatus === "CONFIRMED"
                ? "Voce ja esta confirmado."
                : quickSelectedPresenceStatus === "CANCELED"
                  ? "Voce esta desconfirmado."
                  : "Escolha o jogador e confirme com um toque."}
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-end">
            <label className="w-full min-w-0 sm:w-[60%] sm:min-w-[240px] sm:max-w-md sm:flex-1">
              <span className="field-label">Jogador</span>
              <select
                className="field-input"
                value={quickPlayerId}
                onChange={(event) => handleQuickPlayerSelect(event.currentTarget.value)}
                aria-label="Selecionar jogador para confirmacao rapida"
              >
                <option value="">Selecione...</option>
                {allPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {playerDisplayName(player)}
                  </option>
                ))}
              </select>
            </label>

            {quickPlayerId ? (
              quickSelectedPresenceStatus === "CONFIRMED" ? (
                <Button
                  type="button"
                  className="h-10 w-10 shrink-0 rounded-full bg-red-600 p-0 text-white hover:bg-red-700 sm:w-auto sm:px-4"
                  disabled={!selectedMatch}
                  onClick={() => setPublicPresence(quickPlayerId, "CANCELED")}
                  aria-label="Desconfirmar jogador selecionado"
                >
                  <X size={16} className="sm:hidden" />
                  <span className="hidden sm:inline">Desconfirmar</span>
                </Button>
              ) : (
                <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                  <Button
                    type="button"
                    className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 p-0 text-white hover:bg-emerald-700 sm:w-auto sm:px-4"
                    disabled={!selectedMatch}
                    onClick={() => setPublicPresence(quickPlayerId, "CONFIRMED")}
                    aria-label="Confirmar presenca do jogador selecionado"
                  >
                    <Check size={16} className="sm:hidden" />
                    <span className="hidden sm:inline">Confirmar</span>
                  </Button>
                  {quickSelectedPresenceStatus !== "CANCELED" ? (
                    <Button
                      type="button"
                      className="h-10 w-10 shrink-0 rounded-full bg-red-600 p-0 text-white hover:bg-red-700 sm:w-auto sm:px-4"
                      disabled={!selectedMatch}
                      onClick={() => setPublicPresence(quickPlayerId, "CANCELED")}
                      aria-label="Marcar jogador selecionado como nao vou"
                    >
                      <X size={16} className="sm:hidden" />
                      <span className="hidden sm:inline">Nao vou</span>
                    </Button>
                  ) : null}
                </div>
              )
            ) : null}
          </div>

          {!selectedMatch ? (
            <p className="text-sm text-amber-700">Selecione uma partida para confirmar presenca.</p>
          ) : null}
        </ActionBar>
      )}

      {!isAuthenticatedPlayerHome && selectedMatch ? (
        <section className="section-shell p-4 sm:p-5">
          <label>
            <span className="field-label">Buscar jogador</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                className="field-input"
                type="text"
                placeholder="Digite o nome do jogador..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.currentTarget.value)}
              />
              {searchTerm ? (
                <Button type="button" variant="outline" className="rounded-full" onClick={() => setSearchTerm("")}>Limpar</Button>
              ) : null}
            </div>
          </label>
        </section>
      ) : null}

      {!isAuthenticatedPlayerHome && selectedMatch ? (
        <ActionBar className="sticky sticky-app-offset z-10 p-1.5 sm:p-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={listViewFilter === "ALL" ? "default" : "outline"}
              className="h-8 rounded-full px-2 text-xs sm:h-9 sm:px-4 sm:text-sm"
              onClick={() => setListViewFilter("ALL")}
            >
              Todos
            </Button>
            <Button
              type="button"
              variant={listViewFilter === "PENDING" ? "default" : "outline"}
              className={cn(
                "h-8 w-16 rounded-full p-0 text-xs sm:h-9 sm:w-auto sm:px-4 sm:text-sm",
                listViewFilter === "PENDING"
                  ? "bg-amber-500 text-white hover:bg-amber-600 sm:bg-emerald-700 sm:hover:bg-emerald-800"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 sm:border-[#9ecdb4] sm:bg-white sm:text-[#15452f]",
              )}
              onClick={() => setListViewFilter("PENDING")}
              aria-label="Filtrar pendentes"
            >
              <RotateCcw size={14} className="sm:hidden" />
              <span className="hidden sm:inline">Pendentes</span>
            </Button>
            <Button
              type="button"
              variant={listViewFilter === "CONFIRMED" ? "default" : "outline"}
              className={cn(
                "h-8 w-16 rounded-full p-0 text-xs sm:h-9 sm:w-auto sm:px-4 sm:text-sm",
                listViewFilter === "CONFIRMED"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 sm:border-[#9ecdb4] sm:bg-white sm:text-[#15452f]",
              )}
              onClick={() => setListViewFilter("CONFIRMED")}
              aria-label="Filtrar confirmados"
            >
              <Check size={14} className="sm:hidden" />
              <span className="hidden sm:inline">Confirmados</span>
            </Button>
            <Button
              type="button"
              variant={listViewFilter === "CANCELED" ? "default" : "outline"}
              className={cn(
                "h-8 w-16 rounded-full p-0 text-xs sm:h-9 sm:w-auto sm:px-4 sm:text-sm",
                listViewFilter === "CANCELED"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 sm:border-[#9ecdb4] sm:bg-white sm:text-[#15452f]",
              )}
              onClick={() => setListViewFilter("CANCELED")}
              aria-label="Filtrar desconfirmados"
            >
              <X size={14} className="sm:hidden" />
              <span className="hidden sm:inline">Desconfirmados</span>
            </Button>
          </div>
        </ActionBar>
      ) : null}

      {selectedMatch && actionMessage ? (
        <StatusNote tone="success">{actionMessage}</StatusNote>
      ) : null}

      {!isAuthenticatedPlayerHome && selectedMatch ? (
        <section className={`grid gap-4 ${listViewFilter === "ALL" ? "md:grid-cols-3" : "md:grid-cols-1"}`}>
          {showPending ? (
            <div className="card p-4">
              <h4 className="text-lg font-semibold text-emerald-900">Pendentes ({filteredPending.length})</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {filteredPending.length === 0 ? (
                  <li className="rounded-lg bg-zinc-50 px-3 py-2 text-emerald-900">
                    Nenhum jogador encontrado para este filtro.
                  </li>
                ) : null}
                {filteredPending.map((player) => (
                  <li
                    key={player.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 px-3 py-2"
                  >
                    <span className="font-medium text-emerald-950">{formatPlayerLabel(player)}</span>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        label="Confirmar jogador"
                        tone="green"
                        onClick={() => setPublicPresence(player.id, "CONFIRMED")}
                      >
                        <Check size={16} />
                      </ActionButton>
                      <ActionButton
                        label="Desconfirmar jogador"
                        tone="red"
                        onClick={() => setPublicPresence(player.id, "CANCELED")}
                      >
                        <X size={16} />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showConfirmed ? (
            <div className="card p-4">
              <h4 className="text-lg font-semibold text-emerald-900">Confirmados ({filteredConfirmed.length})</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {filteredConfirmed.length === 0 ? (
                  <li className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-900">
                    Nenhum jogador encontrado para este filtro.
                  </li>
                ) : null}
                {filteredConfirmed.map((item) => (
                  <li
                    key={item.playerId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2"
                  >
                    <span className="font-medium text-emerald-950">{formatPlayerLabel(item.player)}</span>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        label="Voltar jogador para pendentes"
                        tone="yellow"
                        onClick={() => setPublicPresence(item.playerId, "WAITLIST")}
                      >
                        <RotateCcw size={16} />
                      </ActionButton>
                      <ActionButton
                        label="Desconfirmar jogador"
                        tone="red"
                        onClick={() => setPublicPresence(item.playerId, "CANCELED")}
                      >
                        <X size={16} />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showCanceled ? (
            <div className="card p-4">
              <h4 className="text-lg font-semibold text-emerald-900">Desconfirmados ({filteredCanceled.length})</h4>
              <ul className="mt-2 space-y-2 text-sm">
                {filteredCanceled.length === 0 ? (
                  <li className="rounded-lg bg-red-50 px-3 py-2 text-emerald-900">
                    Nenhum jogador encontrado para este filtro.
                  </li>
                ) : null}
                {filteredCanceled.map((item) => (
                  <li
                    key={item.playerId}
                    className="flex items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2"
                  >
                    <span className="font-medium text-emerald-950">{formatPlayerLabel(item.player)}</span>
                    <div className="flex items-center gap-2">
                      <ActionButton
                        label="Confirmar jogador"
                        tone="green"
                        onClick={() => setPublicPresence(item.playerId, "CONFIRMED")}
                      >
                        <Check size={16} />
                      </ActionButton>
                      <ActionButton
                        label="Voltar jogador para pendentes"
                        tone="yellow"
                        onClick={() => setPublicPresence(item.playerId, "WAITLIST")}
                      >
                        <RotateCcw size={16} />
                      </ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {message ? <StatusNote tone="error">{message}</StatusNote> : null}
    </PageShell>
  );
}










