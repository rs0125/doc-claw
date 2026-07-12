-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('PRESCRIPTION', 'DISCHARGE_SUMMARY', 'LAB_REPORT', 'OTHER');

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL DEFAULT 'OTHER',
    "prescriptionId" TEXT,
    "dischargeSummaryId" TEXT,
    "r2Key" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileName" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_r2Key_key" ON "Attachment"("r2Key");

-- CreateIndex
CREATE INDEX "Attachment_patientId_kind_idx" ON "Attachment"("patientId", "kind");

-- CreateIndex
CREATE INDEX "Attachment_doctorId_idx" ON "Attachment"("doctorId");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_dischargeSummaryId_fkey" FOREIGN KEY ("dischargeSummaryId") REFERENCES "DischargeSummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
