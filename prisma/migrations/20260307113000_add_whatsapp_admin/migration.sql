-- CreateEnum
CREATE TYPE "WhatsAppProvider" AS ENUM ('TWILIO');

-- CreateEnum
CREATE TYPE "WhatsAppMessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "WhatsAppMessageEventType" AS ENUM ('CONFIRM', 'CANCEL', 'TEST');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "whatsapp_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'TWILIO',
    "notifyOnConfirm" BOOLEAN NOT NULL DEFAULT true,
    "notifyOnCancel" BOOLEAN NOT NULL DEFAULT true,
    "confirmTemplate" TEXT NOT NULL,
    "cancelTemplate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_recipients" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message_logs" (
    "id" TEXT NOT NULL,
    "direction" "WhatsAppMessageDirection" NOT NULL DEFAULT 'OUTBOUND',
    "eventType" "WhatsAppMessageEventType" NOT NULL,
    "provider" "WhatsAppProvider" NOT NULL DEFAULT 'TWILIO',
    "providerMessageId" TEXT,
    "recipientPhone" TEXT,
    "body" TEXT NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "errorMessage" TEXT,
    "rawPayload" JSONB,
    "playerId" TEXT,
    "matchId" TEXT,
    "recipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_recipients_settingsId_phoneE164_key" ON "whatsapp_recipients"("settingsId", "phoneE164");

-- CreateIndex
CREATE INDEX "whatsapp_recipients_settingsId_isActive_idx" ON "whatsapp_recipients"("settingsId", "isActive");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_status_createdAt_idx" ON "whatsapp_message_logs"("status", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_message_logs_playerId_matchId_idx" ON "whatsapp_message_logs"("playerId", "matchId");

-- AddForeignKey
ALTER TABLE "whatsapp_recipients" ADD CONSTRAINT "whatsapp_recipients_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "whatsapp_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message_logs" ADD CONSTRAINT "whatsapp_message_logs_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "whatsapp_recipients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
