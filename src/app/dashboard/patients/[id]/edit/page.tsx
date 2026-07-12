import { notFound, redirect } from "next/navigation";
import { FormPage } from "@/components/form-page";
import { PatientForm } from "@/components/forms/patient-form";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { ApiError } from "@/lib/http";
import { getPatient } from "@/services/patients";
import { updatePatientAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function EditPatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const { id } = await params;

  let patient;
  try {
    patient = await getPatient(webAuth(doctor), id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const action = updatePatientAction.bind(null, id);
  return (
    <FormPage
      title={`Edit ${patient.name}`}
      backHref={`/dashboard/patients/${id}`}
      backLabel="Back to patient"
    >
      <PatientForm action={action} patient={patient} submitLabel="Save changes" />
    </FormPage>
  );
}
