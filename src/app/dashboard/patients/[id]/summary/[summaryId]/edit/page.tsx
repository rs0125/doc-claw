import { notFound, redirect } from "next/navigation";
import { FormPage, todayISO } from "@/components/form-page";
import { SummaryForm } from "@/components/forms/summary-form";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { ApiError } from "@/lib/http";
import { getSummary } from "@/services/summaries";
import { updateSummaryAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function EditSummaryPage({
  params,
}: {
  params: Promise<{ id: string; summaryId: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const { id, summaryId } = await params;

  let summary;
  try {
    summary = await getSummary(webAuth(doctor), summaryId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  // A finalized summary is immutable — no edit screen.
  if (summary.status === "FINAL") redirect(`/dashboard/patients/${id}`);

  const action = updateSummaryAction.bind(null, id, summaryId);
  return (
    <FormPage title="Edit discharge summary" backHref={`/dashboard/patients/${id}`} backLabel="Back to patient">
      <SummaryForm action={action} today={todayISO()} summary={summary} submitLabel="Save changes" />
    </FormPage>
  );
}
