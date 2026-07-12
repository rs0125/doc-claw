import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, Pill, Stethoscope, Download, Plus, Pencil, Trash2, Lock, Archive } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { AttachmentStrip } from "@/components/attachment-strip";
import { ConfirmButton } from "@/components/confirm-button";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { ApiError } from "@/lib/http";
import { getPatient } from "@/services/patients";
import { listEncounters } from "@/services/encounters";
import { listPrescriptions } from "@/services/prescriptions";
import { listSummaries } from "@/services/summaries";
import { listAttachments } from "@/services/attachments";
import {
  finalizeSummaryAction,
  archivePatientAction,
  deletePatientAction,
  archiveEncounterAction,
  archivePrescriptionAction,
  archiveSummaryAction,
} from "@/app/dashboard/patient-actions";
import { formatDate as fmtDate } from "@/lib/format";
import type { Medication } from "@/lib/validation";

export const dynamic = "force-dynamic";

function ageFrom(dob: Date | null, approximate = false): string | null {
  if (!dob) return null;
  const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600_000));
  return `${approximate ? "~" : ""}${years} yrs`;
}

function meds(v: unknown): Medication[] {
  return (v ?? []) as Medication[];
}

export default async function PatientPage({ params }: { params: Promise<{ id: string }> }) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const { id } = await params;
  const auth = webAuth(doctor);

  let patient;
  try {
    patient = await getPatient(auth, id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [encounters, prescriptions, summaries, attachments] = await Promise.all([
    listEncounters(auth, id),
    listPrescriptions(auth, id),
    listSummaries(auth, id),
    listAttachments(auth, id),
  ]);
  const rxPhotos = attachments.filter((a) => a.kind === "PRESCRIPTION");
  const summaryPhotos = attachments.filter((a) => a.kind === "DISCHARGE_SUMMARY");

  const facts: { label: string; value: string }[] = [
    { label: "Age", value: ageFrom(patient.dateOfBirth, patient.dobApproximate) ?? "—" },
    { label: "Sex", value: patient.sex === "UNKNOWN" ? "—" : patient.sex.toLowerCase() },
    { label: "Blood group", value: patient.bloodGroup || "—" },
    {
      label: "Date of birth",
      value: patient.dobApproximate ? "Approx (from age)" : fmtDate(patient.dateOfBirth),
    },
    { label: "Phone", value: patient.phone || "—" },
    { label: "ABHA ID", value: patient.abhaId || "—" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Patients
      </Link>

      {/* Demographics */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-xl">{patient.name}</CardTitle>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {[
                  ageFrom(patient.dateOfBirth, patient.dobApproximate),
                  patient.sex === "UNKNOWN" ? null : patient.sex.toLowerCase(),
                ]
                  .filter(Boolean)
                  .join(" · ") || "No demographics"}
              </p>
            </div>
            <Tooltip label="Edit patient details">
              <Link href={`/dashboard/patients/${id}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil /> Edit
                </Button>
              </Link>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{f.label}</dt>
                <dd className="text-sm font-medium capitalize">{f.value}</dd>
              </div>
            ))}
          </dl>
          {patient.allergies.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Allergies</span>
              {patient.allergies.map((a) => (
                <Badge key={a} variant="destructive">
                  {a}
                </Badge>
              ))}
            </div>
          )}
          {patient.chronicConditions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Chronic</span>
              {patient.chronicConditions.map((c) => (
                <Badge key={c} variant="secondary">
                  {c}
                </Badge>
              ))}
            </div>
          )}
          {patient.notes && (
            <p className="border-t pt-3 text-sm text-muted-foreground">{patient.notes}</p>
          )}
        </CardContent>
      </Card>

      {/* Prescriptions */}
      <Section
        icon={<Pill className="size-4" />}
        title="Prescriptions"
        count={prescriptions.length}
        addHref={`/dashboard/patients/${id}/prescription/new`}
        footer={<AttachmentStrip patientId={id} kind="PRESCRIPTION" items={rxPhotos} />}
      >
        {prescriptions.map((rx) => (
          <Card key={rx.id} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{fmtDate(rx.date)}</span>
              <div className="flex items-center gap-1">
                <Tooltip label="Download prescription PDF">
                  <a
                    href={`/dl/prescription/${rx.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Download className="size-3.5" /> PDF
                  </a>
                </Tooltip>
                <Tooltip label="Edit prescription">
                  <Link
                    href={`/dashboard/patients/${id}/prescription/${rx.id}/edit`}
                    className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </Link>
                </Tooltip>
                <ConfirmButton
                  action={archivePrescriptionAction.bind(null, id, rx.id)}
                  trigger={<Trash2 className="size-3.5" />}
                  triggerClassName="size-8 p-0 text-muted-foreground hover:text-destructive"
                  title="Delete prescription?"
                  message="This removes the prescription from the patient's record. It won't appear in lists or PDFs."
                  confirmLabel="Delete prescription"
                />
              </div>
            </div>
            <ul className="flex flex-col gap-1 text-sm">
              {meds(rx.medications).map((m, i) => (
                <li key={i}>
                  {m.name} — {m.dose}, {m.frequency}
                  {m.duration ? `, ${m.duration}` : ""}
                </li>
              ))}
            </ul>
            {rx.advice && <p className="mt-2 text-xs text-muted-foreground">{rx.advice}</p>}
          </Card>
        ))}
      </Section>

      {/* Discharge summaries */}
      <Section
        icon={<FileText className="size-4" />}
        title="Discharge summaries"
        count={summaries.length}
        addHref={`/dashboard/patients/${id}/summary/new`}
        footer={<AttachmentStrip patientId={id} kind="DISCHARGE_SUMMARY" items={summaryPhotos} />}
      >
        {summaries.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">{s.diagnosis}</span>
              <Badge variant={s.status === "FINAL" ? "default" : "outline"}>{s.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {fmtDate(s.admissionDate)} → {fmtDate(s.dischargeDate)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <Tooltip label="Download discharge summary PDF">
                <a
                  href={`/dl/summary/${s.id}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Download className="size-3.5" /> PDF
                </a>
              </Tooltip>
              {s.status === "DRAFT" && (
                <>
                  <Tooltip label="Edit draft">
                    <Link
                      href={`/dashboard/patients/${id}/summary/${s.id}/edit`}
                      className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="size-3.5" />
                    </Link>
                  </Tooltip>
                  <ConfirmButton
                    action={finalizeSummaryAction.bind(null, s.id, id)}
                    trigger={
                      <span className="inline-flex items-center gap-1">
                        <Lock className="size-3.5" /> Finalize
                      </span>
                    }
                    triggerVariant="ghost"
                    triggerClassName="h-8 text-primary"
                    title="Finalize discharge summary?"
                    message="Finalizing locks this summary permanently — it can no longer be edited. Continue?"
                    confirmLabel="Finalize"
                    confirmVariant="default"
                  />
                </>
              )}
              <ConfirmButton
                action={archiveSummaryAction.bind(null, id, s.id)}
                trigger={<Trash2 className="size-3.5" />}
                triggerClassName="size-8 p-0 text-muted-foreground hover:text-destructive"
                title="Delete discharge summary?"
                message="This removes the summary from the patient's record. It won't appear in lists."
                confirmLabel="Delete summary"
              />
            </div>
          </Card>
        ))}
      </Section>

      {/* Encounters */}
      <Section
        icon={<Stethoscope className="size-4" />}
        title="Visits"
        count={encounters.length}
        addHref={`/dashboard/patients/${id}/visit/new`}
      >
        {encounters.map((e) => (
          <Card key={e.id} className="p-4">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{fmtDate(e.date)}</span>
              <div className="flex items-center gap-1">
                {e.diagnosis && <Badge variant="secondary">{e.diagnosis}</Badge>}
                <Tooltip label="Edit visit">
                  <Link
                    href={`/dashboard/patients/${id}/visit/${e.id}/edit`}
                    className="inline-flex rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="size-3.5" />
                  </Link>
                </Tooltip>
                <ConfirmButton
                  action={archiveEncounterAction.bind(null, id, e.id)}
                  trigger={<Trash2 className="size-3.5" />}
                  triggerClassName="size-8 p-0 text-muted-foreground hover:text-destructive"
                  title="Delete visit?"
                  message="This removes the visit from the patient's record. It won't appear in lists."
                  confirmLabel="Delete visit"
                />
              </div>
            </div>
            <p className="text-sm">{e.complaint}</p>
            {e.plan && <p className="mt-1 text-xs text-muted-foreground">Plan: {e.plan}</p>}
          </Card>
        ))}
      </Section>

      {/* Danger zone — archive (reversible) and permanent erasure */}
      <section className="mt-2 flex flex-col gap-2">
        <h2 className="px-1 text-sm font-semibold text-muted-foreground">Manage patient</h2>
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Archive hides this patient from your list (reversible). Delete permanently erases the
            patient and all their records — used for data-erasure requests.
          </p>
          <div className="flex shrink-0 gap-2">
            <ConfirmButton
              action={archivePatientAction.bind(null, id)}
              trigger={
                <span className="inline-flex items-center gap-1">
                  <Archive className="size-4" /> Archive
                </span>
              }
              triggerVariant="outline"
              title="Archive this patient?"
              message="They'll be hidden from your patient list. Their records are kept and this can be reversed."
              confirmLabel="Archive"
              confirmVariant="default"
            />
            <ConfirmButton
              action={deletePatientAction.bind(null, id)}
              trigger={
                <span className="inline-flex items-center gap-1">
                  <Trash2 className="size-4" /> Delete
                </span>
              }
              triggerVariant="destructive"
              title={`Permanently delete ${patient.name}?`}
              message="This erases the patient and ALL their visits, prescriptions, summaries and uploaded files, including from storage. This cannot be undone."
              confirmLabel="Delete permanently"
            />
          </div>
        </Card>
      </section>
    </div>
  );
}

function Section({
  icon,
  title,
  count,
  addHref,
  footer,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  footer?: React.ReactNode;
  addHref?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          {icon}
          {title}
          <span className="text-xs font-normal">({count})</span>
        </h2>
        {addHref && (
          <Tooltip label={`Add ${title.toLowerCase()}`}>
            <Link href={addHref}>
              <Button variant="ghost" size="sm">
                <Plus /> Add
              </Button>
            </Link>
          </Tooltip>
        )}
      </div>
      {count === 0 ? (
        <Card className="p-4 text-center text-xs text-muted-foreground">None on file</Card>
      ) : (
        children
      )}
      {footer}
    </section>
  );
}
