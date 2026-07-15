import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { Surgery, Doctor, Patient, Prescription } from "@/generated/prisma/client";
import { renderSurgeryPdf, renderPrescriptionPdf } from "@/lib/pdf";

const doctor = {
  name: "Dr. A Sharma",
  registrationNumber: "MH-12345",
  clinicName: "Sharma Clinic",
} as Doctor;

const patient = {
  name: "Ramesh Kumar",
  dateOfBirth: new Date("1961-03-14"),
  sex: "MALE",
  bloodGroup: "B+",
  abhaId: null,
} as Patient;

const surgery = {
  status: "DRAFT",
  admissionDate: new Date("2026-07-01"),
  dischargeDate: new Date("2026-07-05"),
  diagnosis: "Community-acquired pneumonia",
  presentingComplaint: null,
  hospitalCourse: "Lorem ipsum ".repeat(300), // long enough to force pagination
  investigations: null,
  treatmentGiven: null,
  conditionAtDischarge: null,
  medicationsAtDischarge: [{ name: "Cefixime", dose: "200 mg", frequency: "1-0-1" }],
  followUpInstructions: "Review in 1 week",
} as unknown as Surgery;

const prescription = {
  date: new Date("2026-07-12"),
  medications: [
    { name: "Paracetamol", dose: "650 mg", frequency: "1-1-1", duration: "3 days" },
    { name: "Cetirizine", dose: "10 mg", frequency: "0-0-1" },
  ],
  advice: "Plenty of fluids.",
  followUpDate: new Date("2026-07-19"),
} as unknown as Prescription;

describe("PDF rendering", () => {
  it("renders a loadable surgery PDF, paginating long content", async () => {
    const bytes = await renderSurgeryPdf(surgery, patient, doctor);
    expect(bytes.length).toBeGreaterThan(500);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("renders a single-page prescription PDF", async () => {
    const bytes = await renderPrescriptionPdf(prescription, patient, doctor);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
  });

  it("handles minimal records without optional fields", async () => {
    const minimal = {
      ...surgery,
      status: "FINAL",
      medicationsAtDischarge: null,
      followUpInstructions: null,
      hospitalCourse: "Uneventful.",
    } as unknown as Surgery;
    const bare = { ...patient, dateOfBirth: null, bloodGroup: null } as Patient;
    const bytes = await renderSurgeryPdf(minimal, bare, {
      ...doctor,
      registrationNumber: null,
      clinicName: null,
    } as Doctor);
    await expect(PDFDocument.load(bytes)).resolves.toBeDefined();
  });
});
