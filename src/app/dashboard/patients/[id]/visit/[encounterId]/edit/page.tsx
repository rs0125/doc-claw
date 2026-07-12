import { notFound, redirect } from "next/navigation";
import { FormPage, todayISO } from "@/components/form-page";
import { VisitForm } from "@/components/forms/visit-form";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { ApiError } from "@/lib/http";
import { getEncounter } from "@/services/encounters";
import { updateEncounterAction } from "@/app/dashboard/patient-actions";

export const dynamic = "force-dynamic";

export default async function EditVisitPage({
  params,
}: {
  params: Promise<{ id: string; encounterId: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const { id, encounterId } = await params;

  let encounter;
  try {
    encounter = await getEncounter(webAuth(doctor), encounterId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const action = updateEncounterAction.bind(null, id, encounterId);
  return (
    <FormPage title="Edit visit" backHref={`/dashboard/patients/${id}`} backLabel="Back to patient">
      <VisitForm action={action} today={todayISO()} encounter={encounter} submitLabel="Save changes" />
    </FormPage>
  );
}
