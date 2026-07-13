"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, Loader2 } from "lucide-react";

/** A single attachment thumbnail with a hover delete button. */
export function AttachmentThumb({
  id,
  contentType,
  fileName,
}: {
  id: string;
  contentType: string;
  fileName?: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function del() {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    setBusy(true);
    try {
      await fetch(`/api/attachments/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="group relative overflow-hidden rounded-md border">
      <a href={`/dl/attachment/${id}`} target="_blank" rel="noopener noreferrer">
        {contentType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/dl/attachment/${id}`} alt={fileName ?? "attachment"} className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </div>
        )}
      </a>
      <button
        type="button"
        onClick={del}
        disabled={busy}
        aria-label="Delete file"
        className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 pointer-coarse:opacity-100"
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
      </button>
    </div>
  );
}
