import type { Attachment, AttachmentKind } from "@/generated/prisma/client";
import { AttachmentUpload } from "@/components/forms/attachment-upload";
import { AttachmentThumb } from "@/components/attachment-thumb";

/**
 * Compact photo/scan row attached to a single record (prescription or discharge
 * surgery). The upload links the file to that record via prescriptionId /
 * surgeryId. Rendered inside the record entry as an optional supplement.
 */
export function AttachmentStrip({
  patientId,
  kind,
  items,
  prescriptionId,
  surgeryId,
  label = "Photos",
}: {
  patientId: string;
  kind: AttachmentKind;
  items: Attachment[];
  prescriptionId?: string;
  surgeryId?: string;
  label?: string;
}) {
  return (
    <div className="mt-2 flex flex-col gap-2 border-t pt-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {label}
          {items.length > 0 ? ` (${items.length})` : ""}
        </span>
        <AttachmentUpload
          patientId={patientId}
          kind={kind}
          prescriptionId={prescriptionId}
          surgeryId={surgeryId}
          compact
        />
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
          {items.map((att) => (
            <AttachmentThumb
              key={att.id}
              id={att.id}
              contentType={att.contentType}
              fileName={att.fileName}
            />
          ))}
        </div>
      )}
    </div>
  );
}
