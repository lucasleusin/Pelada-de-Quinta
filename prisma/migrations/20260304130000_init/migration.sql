-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GOLEIRO', 'ZAGUEIRO', 'MEIA', 'ATACANTE', 'OUTRO');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('DRAFT', 'CONFIRMATION_OPEN', 'TEAMS_LOCKED', 'FINISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('CONFIRMED', 'WAITLIST', 'CANCELED');

-- CreateEnum
CREATE TYPE "Team" AS ENUM ('A', 'B');

-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" "Position" NOT NULL DEFAULT 'OUTRO',
    "shirtNumberPreference" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "matchDate" DATE NOT NULL,
    "location" TEXT,
    "startTime" TEXT NOT NULL DEFAULT '19:00',
    "status" "MatchStatus" NOT NULL DEFAULT 'DRAFT',
    "teamAName" TEXT NOT NULL DEFAULT 'Time A',
    "teamBName" TEXT NOT NULL DEFAULT 'Time B',
    "teamAScore" INTEGER,
    "teamBScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_participants" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "presenceStatus" "PresenceStatus" NOT NULL DEFAULT 'CANCELED',
    "team" "Team",
    "playedAsGoalkeeper" BOOLEAN NOT NULL DEFAULT false,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "goalsConceded" INTEGER NOT NULL DEFAULT 0,
    "statsUpdatedByPlayerId" TEXT,
    "statsUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_ratings" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "raterPlayerId" TEXT NOT NULL,
    "ratedPlayerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "players_name_key" ON "players"("name");

-- CreateIndex
CREATE INDEX "players_name_idx" ON "players"("name");

-- CreateIndex
CREATE INDEX "matches_matchDate_status_idx" ON "matches"("matchDate", "status");

-- CreateIndex
CREATE INDEX "match_participants_matchId_presenceStatus_idx" ON "match_participants"("matchId", "presenceStatus");

-- CreateIndex
CREATE INDEX "match_participants_playerId_idx" ON "match_participants"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "match_participants_matchId_playerId_key" ON "match_participants"("matchId", "playerId");

-- CreateIndex
CREATE INDEX "match_ratings_matchId_ratedPlayerId_idx" ON "match_ratings"("matchId", "ratedPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "match_ratings_matchId_raterPlayerId_ratedPlayerId_key" ON "match_ratings"("matchId", "raterPlayerId", "ratedPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users"("email");

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_statsUpdatedByPlayerId_fkey" FOREIGN KEY ("statsUpdatedByPlayerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_ratings" ADD CONSTRAINT "match_ratings_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_ratings" ADD CONSTRAINT "match_ratings_raterPlayerId_fkey" FOREIGN KEY ("raterPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_ratings" ADD CONSTRAINT "match_ratings_ratedPlayerId_fkey" FOREIGN KEY ("ratedPlayerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data checks
ALTER TABLE "match_ratings"
ADD CONSTRAINT "match_ratings_rating_check" CHECK ("rating" >= 0 AND "rating" <= 5);

ALTER TABLE "match_participants"
ADD CONSTRAINT "match_participants_goals_check" CHECK ("goals" >= 0),
ADD CONSTRAINT "match_participants_assists_check" CHECK ("assists" >= 0),
ADD CONSTRAINT "match_participants_goals_conceded_check" CHECK ("goalsConceded" >= 0);

