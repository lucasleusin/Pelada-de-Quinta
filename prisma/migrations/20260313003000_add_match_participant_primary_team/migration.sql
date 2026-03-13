ALTER TABLE "match_participants"
ADD COLUMN "primaryTeam" "Team";

UPDATE "match_participants"
SET "primaryTeam" = CASE
  WHEN array_length("teams", 1) IS NULL THEN NULL
  ELSE "teams"[1]
END;

CREATE INDEX "match_participants_matchId_primaryTeam_idx"
ON "match_participants"("matchId", "primaryTeam");
