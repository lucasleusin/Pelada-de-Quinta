ALTER TABLE "match_participants"
ADD COLUMN "confirmedAt" TIMESTAMP(3);

UPDATE "match_participants"
SET "confirmedAt" = "updatedAt"
WHERE "presenceStatus" = 'CONFIRMED';

CREATE INDEX "match_participants_matchId_confirmedAt_idx"
ON "match_participants"("matchId", "confirmedAt");
