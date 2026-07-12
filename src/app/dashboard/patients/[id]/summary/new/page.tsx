import { FormPage, todayISO } from "@/components/form-page";
import { SummaryForm } from "@/components/forms/summary-form";
import { createSummaryAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function NewSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const action = createSummaryAction.bind(null, id);
  return (
    <FormPage
      title="New discharge summary"
      backHref={`/dashboard/patients/${id}`}
      backLabel="Back to patient"
    >
      <SummaryForm action={action} today={todayISO()} />
    </FormPage>
  );
}
