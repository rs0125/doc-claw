import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { DischargeSummary, Doctor, Patient, Prescription } from "@/generated/prisma/client";
import type { Medication } from "@/lib/validation";

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 50;
const BODY_SIZE = 10;
const LINE_HEIGHT = 14;

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
}

function formatMedications(meds: Medication[]): string {
  return meds
    .map(
      (m, i) =>
        `${i + 1}. ${m.name} — ${m.dose}, ${m.frequency}${m.duration ? `, ${m.duration}` : ""}${m.notes ? ` (${m.notes})` : ""}`,
    )
    .join("\n");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

type Writer = {
  line: (text: string, opts?: { bold?: boolean; size?: number }) => void;
  section: (title: string, body: string | null | undefined) => void;
  gap: (fraction?: number) => void;
  save: () => Promise<Uint8Array>;
};

async function createWriter(): Promise<Writer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE.width - MARGIN * 2;

  let page: PDFPage = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const ensureRoom = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };

  const line: Writer["line"] = (text, opts = {}) => {
    const f = opts.bold ? bold : font;
    const size = opts.size ?? BODY_SIZE;
    for (const l of wrapText(text, f, size, maxWidth)) {
      ensureRoom(LINE_HEIGHT);
      page.drawText(l, { x: MARGIN, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE_HEIGHT;
    }
  };

  const section: Writer["section"] = (title, body) => {
    if (!body) return;
    ensureRoom(LINE_HEIGHT * 3);
    y -= LINE_HEIGHT / 2;
    line(title.toUpperCase(), { bold: true });
    line(body);
  };

  const gap: Writer["gap"] = (fraction = 0.5) => {
    y -= LINE_HEIGHT * fraction;
  };

  return { line, section, gap, save: () => doc.save() };
}

function drawLetterhead(w: Writer, title: string, doctor: Doctor, patient: Patient) {
  w.line(title, { bold: true, size: 16 });
  w.gap();
  w.line(
    `Doctor: ${doctor.name}${doctor.registrationNumber ? ` (Reg. No. ${doctor.registrationNumber})` : ""}`,
  );
  if (doctor.clinicName) w.line(`Clinic: ${doctor.clinicName}`);
  w.gap();
  w.line(`Patient: ${patient.name}`, { bold: true });
  w.line(
    `DOB: ${formatDate(patient.dateOfBirth)}   Sex: ${patient.sex}   Blood group: ${patient.bloodGroup ?? "—"}`,
  );
  if (patient.abhaId) w.line(`ABHA ID: ${patient.abhaId}`);
}

function drawFooter(w: Writer) {
  w.gap(1);
  w.line(`Generated on ${new Date().toISOString().slice(0, 10)} via doctor-openclaw`, { size: 8 });
}

/** Renders a discharge summary as a simple A4 PDF. Layout is intentionally plain for the MVP. */
export async function renderDischargeSummaryPdf(
  summary: DischargeSummary,
  patient: Patient,
  doctor: Doctor,
): Promise<Uint8Array> {
  const w = await createWriter();

  drawLetterhead(w, "DISCHARGE SUMMARY", doctor, patient);
  if (summary.status === "DRAFT") {
    w.gap();
    w.line("*** DRAFT — NOT FINALISED ***", { bold: true });
  }
  w.line(
    `Admitted: ${formatDate(summary.admissionDate)}   Discharged: ${formatDate(summary.dischargeDate)}`,
  );

  w.section("Diagnosis", summary.diagnosis);
  w.section("Presenting complaint", summary.presentingComplaint);
  w.section("Hospital course", summary.hospitalCourse);
  w.section("Investigations", summary.investigations);
  w.section("Treatment given", summary.treatmentGiven);
  w.section("Condition at discharge", summary.conditionAtDischarge);

  const meds = (summary.medicationsAtDischarge ?? []) as Medication[];
  if (meds.length > 0) w.section("Medications at discharge", formatMedications(meds));

  w.section("Follow-up instructions", summary.followUpInstructions);
  drawFooter(w);

  return w.save();
}

export async function renderPrescriptionPdf(
  prescription: Prescription,
  patient: Patient,
  doctor: Doctor,
): Promise<Uint8Array> {
  const w = await createWriter();

  drawLetterhead(w, "PRESCRIPTION", doctor, patient);
  w.line(`Date: ${formatDate(prescription.date)}`);

  const meds = (prescription.medications ?? []) as Medication[];
  w.section("Rx", formatMedications(meds));
  w.section("Advice", prescription.advice);
  if (prescription.followUpDate) {
    w.section("Follow-up", `Review on ${formatDate(prescription.followUpDate)}`);
  }
  drawFooter(w);

  return w.save();
}
