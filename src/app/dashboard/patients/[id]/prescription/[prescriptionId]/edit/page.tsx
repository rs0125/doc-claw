import { notFound, redirect } from "next/navigation";
import { FormPage, todayISO } from "@/components/form-page";
import { PrescriptionForm } from "@/components/forms/prescription-form";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { ApiError } from "@/lib/http";
import { getPrescription } from "@/services/prescriptions";
import { updatePrescriptionAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function EditPrescriptionPage({
  params,
}: {
  params: Promise<{ id: string; prescriptionId: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const { id, prescriptionId } = await params;

  let prescription;
  try {
    prescription = await getPrescription(webAuth(doctor), prescriptionId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const action = updatePrescriptionAction.bind(null, id, prescriptionId);
  return (
    <FormPage title="Edit prescription" backHref={`/dashboard/patients/${id}`} backLabel="Back to patient">
      <PrescriptionForm action={action} today={todayISO()} prescription={prescription} submitLabel="Save changes" />
    </FormPage>
  );
}
