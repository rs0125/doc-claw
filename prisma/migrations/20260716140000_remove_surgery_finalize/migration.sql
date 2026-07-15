-- Remove the finalize/lock feature: surgery records are always editable now.
-- The historical finalize events remain in AuditLog; only the status flag is
-- dropped. Existing FINAL rows simply become ordinary editable records.

ALTER TABLE "Surgery" DROP COLUMN "status";
DROP TYPE "SurgeryStatus";
