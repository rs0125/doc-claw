-- AlterTable
ALTER TABLE "TelegramLink" ADD COLUMN     "linkCodeExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ProcessedTelegramUpdate" (
    "updateId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedTelegramUpdate_pkey" PRIMARY KEY ("updateId")
);
