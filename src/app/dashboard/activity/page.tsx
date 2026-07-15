import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { listAuditLogs } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Human labels for the audit action codes.
const ACTION_LABEL: Record<string, string> = {
  "patient.create": "Created patient",
  "patient.update": "Updated patient",
  "patient.read": "Viewed patient",
  "patient.search": "Searched patients",
  "patient.archive": "Archived patient",
  "patient.delete": "Deleted patient",
  "encounter.create": "Recorded visit",
  "encounter.update": "Updated visit",
  "encounter.archive": "Deleted visit",
  "prescription.create": "Wrote prescription",
  "prescription.update": "Updated prescription",
  "prescription.archive": "Deleted prescription",
  "prescription.document.download": "Downloaded prescription PDF",
  "surgery.create": "Created surgery record",
  "surgery.update": "Updated surgery record",
  "surgery.finalize": "Finalized surgery record",
  "surgery.archive": "Deleted surgery record",
  "surgery.document.download": "Downloaded surgery PDF",
  // Legacy codes from before the discharge-summary → surgery rename. Audit rows
  // are immutable history, so old codes are mapped at display time instead.
  "summary.create": "Created surgery record",
  "summary.update": "Updated surgery record",
  "summary.finalize": "Finalized surgery record",
  "summary.archive": "Deleted surgery record",
  "summary.document.download": "Downloaded surgery PDF",
  "attachment.create": "Uploaded a file",
  "attachment.delete": "Deleted a file",
  "attachment.download": "Viewed a file",
};

function when(d: Date): string {
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default async function ActivityPage() {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");

  const logs = await listAuditLogs(webAuth(doctor), 200);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard/account"
        className="-my-2.5 inline-flex items-center gap-1 self-start py-2.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Account
      </Link>

      <div>
        <h1 className="text-xl font-semibold">Activity log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every action on your records, newest first — including changes made via the Telegram bot.
        </p>
      </div>

      <Card className="divide-y">
        {logs.length === 0 && (
          <div className="p-4 text-center text-sm text-muted-foreground">No activity yet.</div>
        )}
        {logs.map((l) => {
          const via = (l.details as { via?: string } | null)?.via;
          return (
            <div key={l.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{ACTION_LABEL[l.action] ?? l.action}</div>
                <div className="text-xs text-muted-foreground">
                  {when(l.createdAt)}
                  {via ? ` · via ${via === "telegram-agent" ? "Telegram" : via}` : ""}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
