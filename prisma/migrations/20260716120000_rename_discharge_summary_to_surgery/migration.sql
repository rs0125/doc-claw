-- Rename the "discharge summary" record type to "surgery" (Indian clinical usage).
-- This is a pure rename — all existing rows and links are preserved. No data is
-- dropped or recreated.

-- 1. AttachmentKind enum value
ALTER TYPE "AttachmentKind" RENAME VALUE 'DISCHARGE_SUMMARY' TO 'SURGERY';

-- 2. Status enum type (DRAFT/FINAL values unchanged)
ALTER TYPE "SummaryStatus" RENAME TO "SurgeryStatus";

-- 3. The table itself
ALTER TABLE "DischargeSummary" RENAME TO "Surgery";

-- 4. Constraints and indexes on the renamed table
ALTER TABLE "Surgery" RENAME CONSTRAINT "DischargeSummary_pkey" TO "Surgery_pkey";
ALTER TABLE "Surgery" RENAME CONSTRAINT "DischargeSummary_doctorId_fkey" TO "Surgery_doctorId_fkey";
ALTER TABLE "Surgery" RENAME CONSTRAINT "DischargeSummary_patientId_fkey" TO "Surgery_patientId_fkey";
ALTER INDEX "DischargeSummary_doctorId_idx" RENAME TO "Surgery_doctorId_idx";
ALTER INDEX "DischargeSummary_patientId_idx" RENAME TO "Surgery_patientId_idx";

-- 5. The Attachment foreign-key column + constraint that links to it
ALTER TABLE "Attachment" RENAME COLUMN "dischargeSummaryId" TO "surgeryId";
ALTER TABLE "Attachment" RENAME CONSTRAINT "Attachment_dischargeSummaryId_fkey" TO "Attachment_surgeryId_fkey";
