import type { Attachment, AttachmentKind } from "@/generated/prisma/client";
import { AttachmentUpload } from "@/components/forms/attachment-upload";
import { AttachmentThumb } from "@/components/attachment-thumb";

/** Photo/scan thumbnails for one record kind, with a fixed-kind upload button. */
export function AttachmentStrip({
  patientId,
  kind,
  items,
}: {
  patientId: string;
  kind: AttachmentKind;
  items: Attachment[];
}) {
  return (
    <div className="mt-1 flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Photos &amp; scans {items.length > 0 && `(${items.length})`}
        </span>
        <AttachmentUpload patientId={patientId} kind={kind} />
      </div>
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
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
