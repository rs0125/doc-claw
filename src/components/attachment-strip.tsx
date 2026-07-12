import { FileText } from "lucide-react";
import type { Attachment, AttachmentKind } from "@/generated/prisma/client";
import { AttachmentUpload } from "@/components/forms/attachment-upload";
import { Tooltip } from "@/components/ui/tooltip";

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
            <Tooltip key={att.id} label={att.fileName ?? "Open"}>
              <a
                href={`/dl/attachment/${att.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-md border"
              >
                {att.contentType.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/dl/attachment/${att.id}`}
                    alt="attachment"
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-muted">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                )}
              </a>
            </Tooltip>
          ))}
        </div>
      )}
    </div>
  );
}
