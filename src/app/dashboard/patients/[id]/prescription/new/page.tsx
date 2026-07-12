import { FormPage, todayISO } from "@/components/form-page";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { addPrescriptionAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function NewPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const action = addPrescriptionAction.bind(null, id);
  return (
    <FormPage
      title="New prescription"
      backHref={`/dashboard/patients/${id}`}
      backLabel="Back to patient"
    >
      <PrescriptionForm action={action} today={todayISO()} />
    </FormPage>
  );
}
