ALTER TABLE "players"
ADD COLUMN "mergedIntoPlayerId" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3),
ADD COLUMN "mergedByUserId" TEXT;

ALTER TABLE "users"
ADD COLUMN "mergedIntoUserId" TEXT,
ADD COLUMN "mergedAt" TIMESTAMP(3),
ADD COLUMN "mergedByUserId" TEXT;

CREATE INDEX "players_mergedIntoPlayerId_idx" ON "players"("mergedIntoPlayerId");
CREATE INDEX "users_mergedIntoUserId_idx" ON "users"("mergedIntoUserId");

ALTER TABLE "players"
ADD CONSTRAINT "players_mergedIntoPlayerId_fkey"
FOREIGN KEY ("mergedIntoPlayerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "players"
ADD CONSTRAINT "players_mergedByUserId_fkey"
FOREIGN KEY ("mergedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
ADD CONSTRAINT "users_mergedIntoUserId_fkey"
FOREIGN KEY ("mergedIntoUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "users"
ADD CONSTRAINT "users_mergedByUserId_fkey"
FOREIGN KEY ("mergedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
