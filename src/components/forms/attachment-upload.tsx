"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Kind = "PRESCRIPTION" | "DISCHARGE_SUMMARY" | "LAB_REPORT" | "OTHER";

/** Uploads an image/PDF straight to R2 via a presigned PUT, then confirms.
 * With a fixed `kind` the type selector is hidden. An optional prescriptionId /
 * dischargeSummaryId links the file to that specific record. `compact` shows just
 * a small "Add photo" button (used inside a record entry). */
export function AttachmentUpload({
  patientId,
  kind: fixedKind,
  prescriptionId,
  dischargeSummaryId,
  compact,
}: {
  patientId: string;
  kind?: Kind;
  prescriptionId?: string;
  dischargeSummaryId?: string;
  compact?: boolean;
}) {
  const [kind, setKind] = useState<Kind>(fixedKind ?? "PRESCRIPTION");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function onFile(file: File) {
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          kind,
          contentType: file.type,
          fileName: file.name,
          prescriptionId,
          dischargeSummaryId,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Could not start upload");
      const { attachmentId, uploadUrl } = await res.json();

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");

      await fetch(`/api/attachments/${attachmentId}/complete`, { method: "POST" });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {!fixedKind && (
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Kind)}
            disabled={busy}
            className="h-9 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="PRESCRIPTION">Prescription</option>
            <option value="DISCHARGE_SUMMARY">Discharge summary</option>
            <option value="LAB_REPORT">Lab report</option>
            <option value="OTHER">Other</option>
          </select>
        )}
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className={compact ? "h-10 px-2.5 text-xs text-muted-foreground" : ""}
        >
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {busy ? "Uploading…" : compact ? "Add photo" : "Upload photo"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
