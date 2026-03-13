ALTER TABLE "match_participants"
ADD COLUMN "teams" "Team"[] NOT NULL DEFAULT ARRAY[]::"Team"[],
ADD COLUMN "teamAGoals" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "teamAAssists" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "teamAGoalsConceded" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "teamBGoals" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "teamBAssists" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "teamBGoalsConceded" INTEGER NOT NULL DEFAULT 0;

UPDATE "match_participants"
SET
  "teams" = CASE
    WHEN "team" IS NULL THEN ARRAY[]::"Team"[]
    ELSE ARRAY["team"]::"Team"[]
  END,
  "teamAGoals" = CASE WHEN "team" = 'A' THEN "goals" ELSE 0 END,
  "teamAAssists" = CASE WHEN "team" = 'A' THEN "assists" ELSE 0 END,
  "teamAGoalsConceded" = CASE WHEN "team" = 'A' THEN "goalsConceded" ELSE 0 END,
  "teamBGoals" = CASE WHEN "team" = 'B' THEN "goals" ELSE 0 END,
  "teamBAssists" = CASE WHEN "team" = 'B' THEN "assists" ELSE 0 END,
  "teamBGoalsConceded" = CASE WHEN "team" = 'B' THEN "goalsConceded" ELSE 0 END;

ALTER TABLE "match_participants"
DROP COLUMN "team";
