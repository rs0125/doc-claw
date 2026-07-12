import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { DischargeSummary, Doctor, Patient } from "@/generated/prisma/client";
import type { Medication } from "@/lib/validation";

const PAGE = { width: 595.28, height: 841.89 }; // A4
const MARGIN = 50;
const BODY_SIZE = 10;
const LINE_HEIGHT = 14;

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toISOString().slice(0, 10);
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

/** Renders a discharge summary as a simple A4 PDF. Layout is intentionally plain for the MVP. */
export async function renderDischargeSummaryPdf(
  summary: DischargeSummary,
  patient: Patient,
  doctor: Doctor,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const maxWidth = PAGE.width - MARGIN * 2;

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;

  const ensureRoom = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - MARGIN;
    }
  };

  const drawLine = (text: string, f: PDFFont = font, size = BODY_SIZE) => {
    for (const line of wrapText(text, f, size, maxWidth)) {
      ensureRoom(LINE_HEIGHT);
      page.drawText(line, { x: MARGIN, y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      y -= LINE_HEIGHT;
    }
  };

  const drawSection = (title: string, body: string | null | undefined) => {
    if (!body) return;
    ensureRoom(LINE_HEIGHT * 3);
    y -= LINE_HEIGHT / 2;
    drawLine(title.toUpperCase(), bold, 10);
    drawLine(body);
  };

  drawLine("DISCHARGE SUMMARY", bold, 16);
  y -= LINE_HEIGHT / 2;
  if (summary.status === "DRAFT") drawLine("*** DRAFT — NOT FINALISED ***", bold, 10);
  y -= LINE_HEIGHT / 2;

  drawLine(`Doctor: ${doctor.name}${doctor.registrationNumber ? ` (Reg. No. ${doctor.registrationNumber})` : ""}`);
  if (doctor.clinicName) drawLine(`Clinic: ${doctor.clinicName}`);
  y -= LINE_HEIGHT / 2;

  drawLine(`Patient: ${patient.name}`, bold);
  drawLine(
    `DOB: ${formatDate(patient.dateOfBirth)}   Sex: ${patient.sex}   Blood group: ${patient.bloodGroup ?? "—"}`,
  );
  if (patient.abhaId) drawLine(`ABHA ID: ${patient.abhaId}`);
  drawLine(`Admitted: ${formatDate(summary.admissionDate)}   Discharged: ${formatDate(summary.dischargeDate)}`);

  drawSection("Diagnosis", summary.diagnosis);
  drawSection("Presenting complaint", summary.presentingComplaint);
  drawSection("Hospital course", summary.hospitalCourse);
  drawSection("Investigations", summary.investigations);
  drawSection("Treatment given", summary.treatmentGiven);
  drawSection("Condition at discharge", summary.conditionAtDischarge);

  const meds = (summary.medicationsAtDischarge ?? []) as Medication[];
  if (meds.length > 0) {
    const medLines = meds
      .map(
        (m, i) =>
          `${i + 1}. ${m.name} — ${m.dose}, ${m.frequency}${m.duration ? `, ${m.duration}` : ""}${m.notes ? ` (${m.notes})` : ""}`,
      )
      .join("\n");
    drawSection("Medications at discharge", medLines);
  }

  drawSection("Follow-up instructions", summary.followUpInstructions);

  y -= LINE_HEIGHT;
  drawLine(`Generated on ${new Date().toISOString().slice(0, 10)} via doctor-openclaw`, font, 8);

  return doc.save();
}
