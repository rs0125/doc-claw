import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, FileText, Pill, Stethoscope, Download, Plus, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { AttachmentStrip } from "@/components/attachment-strip";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { ApiError } from "@/lib/http";
import { getPatient } from "@/services/patients";
import { listEncounters } from "@/services/encounters";
import { listPrescriptions } from "@/services/prescriptions";
import { listSummaries } from "@/services/summaries";
import { listAttachments } from "@/services/attachments";
import { finalizeSummaryAction } from "@/app/dashboard/patient-actions";
import type { Medication } from "@/lib/validation";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

function ageFrom(dob: Date | null): string | null {
  if (!dob) return null;
  const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600_000));
  return `${years} yrs`;
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
    { label: "Age", value: ageFrom(patient.dateOfBirth) ?? "—" },
    { label: "Sex", value: patient.sex === "UNKNOWN" ? "—" : patient.sex.toLowerCase() },
    { label: "Blood group", value: patient.bloodGroup || "—" },
    { label: "Date of birth", value: fmtDate(patient.dateOfBirth) },
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
                {[ageFrom(patient.dateOfBirth), patient.sex === "UNKNOWN" ? null : patient.sex.toLowerCase()]
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
              <Tooltip label="Download prescription PDF">
                <a
                  href={`/dl/prescription/${rx.id}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="size-3.5" /> PDF
                </a>
              </Tooltip>
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
            <div className="mt-2 flex items-center gap-3">
              <Tooltip label="Download discharge summary PDF">
                <a
                  href={`/dl/summary/${s.id}`}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="size-3.5" /> PDF
                </a>
              </Tooltip>
              {s.status === "DRAFT" && (
                <form action={finalizeSummaryAction.bind(null, s.id, id)}>
                  <Tooltip label="Lock this summary — it can't be edited after">
                    <button
                      type="submit"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Finalize
                    </button>
                  </Tooltip>
                </form>
              )}
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
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">{fmtDate(e.date)}</span>
              {e.diagnosis && <Badge variant="secondary">{e.diagnosis}</Badge>}
            </div>
            <p className="text-sm">{e.complaint}</p>
            {e.plan && <p className="mt-1 text-xs text-muted-foreground">Plan: {e.plan}</p>}
          </Card>
        ))}
      </Section>
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
