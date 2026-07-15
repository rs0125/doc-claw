import { notFound, redirect } from "next/navigation";
import { FormPage, todayISO } from "@/components/form-page";
import { SurgeryForm } from "@/components/forms/surgery-form";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { ApiError } from "@/lib/http";
import { getSurgery } from "@/services/surgeries";
import { updateSurgeryAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function EditSurgeryPage({
  params,
}: {
  params: Promise<{ id: string; surgeryId: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const { id, surgeryId } = await params;

  let surgery;
  try {
    surgery = await getSurgery(webAuth(doctor), surgeryId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  // A finalized surgery is immutable — no edit screen.
  if (surgery.status === "FINAL") redirect(`/dashboard/patients/${id}`);

  const action = updateSurgeryAction.bind(null, id, surgeryId);
  return (
    <FormPage title="Edit surgery" backHref={`/dashboard/patients/${id}`} backLabel="Back to patient">
      <SurgeryForm action={action} today={todayISO()} surgery={surgery} submitLabel="Save changes" />
    </FormPage>
  );
}
