import { FormPage, todayISO } from "@/components/form-page";
import { SurgeryForm } from "@/components/forms/surgery-form";
import { createSurgeryAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function NewSurgeryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const action = createSurgeryAction.bind(null, id);
  return (
    <FormPage
      title="New surgery"
      backHref={`/dashboard/patients/${id}`}
      backLabel="Back to patient"
    >
      <SurgeryForm action={action} today={todayISO()} />
    </FormPage>
  );
}
