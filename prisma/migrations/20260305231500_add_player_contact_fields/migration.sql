ALTER TABLE "players"
ADD COLUMN "email" TEXT,
ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "players_email_key" ON "players"("email");