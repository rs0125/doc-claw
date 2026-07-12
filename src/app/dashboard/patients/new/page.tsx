import { FormPage } from "@/components/form-page";
import { PatientForm } from "@/components/forms/patient-form";
import { createPatientAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default function NewPatientPage() {
  return (
    <FormPage title="New patient" backHref="/dashboard" backLabel="Patients">
      <PatientForm action={createPatientAction} submitLabel="Create patient" />
    </FormPage>
  );
}
