import { FormPage, todayISO } from "@/components/form-page";
import { VisitForm } from "@/components/forms/visit-form";
import { addEncounterAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const action = addEncounterAction.bind(null, id);
  return (
    <FormPage title="Record visit" backHref={`/dashboard/patients/${id}`} backLabel="Back to patient">
      <VisitForm action={action} today={todayISO()} />
    </FormPage>
  );
}
