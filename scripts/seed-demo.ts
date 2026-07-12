/**
 * Reseed Dr. Raghav's account with a realistic demo roster: patients with
 * encounters, prescriptions, and discharge summaries. Idempotent — wipes this
 * doctor's existing patients (cascade) and recreates.
 *
 *   npm run seed-demo
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const EMAIL = "raghav@wareongo.com";

function d(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

async function main() {
  const doctor = await prisma.doctor.findUnique({ where: { email: EMAIL } });
  if (!doctor) throw new Error(`No doctor ${EMAIL} — run create-doctor first`);
  const doctorId = doctor.id;

  // Wipe existing patients (cascade removes their encounters/rx/summaries).
  const removed = await prisma.patient.deleteMany({ where: { doctorId } });
  console.log(`Cleared ${removed.count} existing patient(s).`);

  // 1) Ramesh Kumar — chronic, with a recent OPD visit + prescription.
  const ramesh = await prisma.patient.create({
    data: {
      doctorId,
      name: "Ramesh Kumar",
      dateOfBirth: d("1961-03-14"),
      sex: "MALE",
      phone: "+919800000001",
      bloodGroup: "B+",
      allergies: ["penicillin"],
      chronicConditions: ["Type 2 diabetes", "Hypertension"],
      currentMedications: [
        { name: "Metformin", dose: "500 mg", frequency: "1-0-1" },
        { name: "Telmisartan", dose: "40 mg", frequency: "1-0-0" },
      ],
    },
  });
  const rameshEnc = await prisma.encounter.create({
    data: {
      doctorId,
      patientId: ramesh.id,
      date: d("2026-07-08"),
      complaint: "Routine diabetes review; occasional giddiness",
      examination: "Alert, oriented. No focal deficit.",
      vitals: { bp: "138/86", pulse: 78, weight: "72 kg", fbs: "142 mg/dL" },
      diagnosis: "T2DM — fair control; HTN",
      plan: "Continue current meds; recheck HbA1c in 3 months; reduce salt.",
    },
  });
  await prisma.prescription.create({
    data: {
      doctorId,
      patientId: ramesh.id,
      encounterId: rameshEnc.id,
      date: d("2026-07-08"),
      medications: [
        { name: "Metformin", dose: "500 mg", frequency: "1-0-1", duration: "30 days" },
        { name: "Telmisartan", dose: "40 mg", frequency: "1-0-0", duration: "30 days" },
      ],
      advice: "Low-salt diet, 30 min walk daily, monitor sugar weekly.",
      followUpDate: d("2026-10-08"),
    },
  });

  // 2) Sita Devi — allergy noted; acute visit with a short-course prescription.
  const sita = await prisma.patient.create({
    data: {
      doctorId,
      name: "Sita Devi",
      dateOfBirth: d("1980-05-20"),
      sex: "FEMALE",
      phone: "+919812345678",
      bloodGroup: "O+",
      allergies: ["sulfa drugs"],
      chronicConditions: [],
    },
  });
  const sitaEnc = await prisma.encounter.create({
    data: {
      doctorId,
      patientId: sita.id,
      date: d("2026-07-10"),
      complaint: "Fever and sore throat x2 days",
      examination: "Throat congested, tonsils mildly enlarged. Chest clear.",
      vitals: { temp: "100.8 F", pulse: 92, spo2: 98 },
      diagnosis: "Acute pharyngitis (likely viral)",
      plan: "Symptomatic treatment; return if fever persists >3 days.",
    },
  });
  await prisma.prescription.create({
    data: {
      doctorId,
      patientId: sita.id,
      encounterId: sitaEnc.id,
      date: d("2026-07-10"),
      medications: [
        { name: "Paracetamol", dose: "650 mg", frequency: "1-1-1", duration: "3 days" },
        { name: "Cetirizine", dose: "10 mg", frequency: "0-0-1", duration: "3 days" },
      ],
      advice: "Warm saline gargles, plenty of fluids, rest.",
      followUpDate: d("2026-07-14"),
    },
  });

  // 3) Abdul Rahman — recent inpatient stay, FINAL discharge summary + PDF-ready.
  const abdul = await prisma.patient.create({
    data: {
      doctorId,
      name: "Abdul Rahman",
      dateOfBirth: d("1955-11-02"),
      sex: "MALE",
      phone: "+919845012345",
      bloodGroup: "A+",
      chronicConditions: ["Ischemic heart disease"],
    },
  });
  await prisma.dischargeSummary.create({
    data: {
      doctorId,
      patientId: abdul.id,
      status: "FINAL",
      admissionDate: d("2026-06-28"),
      dischargeDate: d("2026-07-02"),
      diagnosis: "Community-acquired pneumonia (right lower lobe)",
      presentingComplaint: "Fever, productive cough and breathlessness for 4 days",
      hospitalCourse:
        "Admitted with fever and hypoxia. Started on IV ceftriaxone and azithromycin. " +
        "Oxygen supplementation for 48h. Afebrile from day 3, saturation improved. Chest X-ray showed resolving consolidation.",
      investigations: "WBC 14,200; CRP elevated; CXR: RLL consolidation; blood cultures negative.",
      treatmentGiven: "IV ceftriaxone 1 g BD, azithromycin 500 mg OD, nebulisation, O2 support.",
      conditionAtDischarge: "Stable, afebrile, saturating 97% on room air.",
      medicationsAtDischarge: [
        { name: "Cefixime", dose: "200 mg", frequency: "1-0-1", duration: "5 days" },
        { name: "Azithromycin", dose: "500 mg", frequency: "1-0-0", duration: "2 days" },
      ],
      followUpInstructions: "Review in OPD after 1 week with a repeat chest X-ray.",
    },
  });

  // 4) Lakshmi Menon — new patient, one visit, no meds yet (good 'find'/fuzzy demo).
  const lakshmi = await prisma.patient.create({
    data: {
      doctorId,
      name: "Lakshmi Menon",
      dateOfBirth: d("1992-09-15"),
      sex: "FEMALE",
      phone: "+919900011122",
      bloodGroup: "AB+",
    },
  });
  await prisma.encounter.create({
    data: {
      doctorId,
      patientId: lakshmi.id,
      date: d("2026-07-11"),
      complaint: "Recurrent knee pain, worse on climbing stairs",
      examination: "Mild crepitus right knee, no effusion, full range of motion.",
      vitals: { bp: "118/76", pulse: 72 },
      diagnosis: "Early osteoarthritis, right knee",
      plan: "Quadriceps strengthening exercises; X-ray if no improvement in 4 weeks.",
    },
  });

  // 5) Mohammed Ali — a DRAFT discharge summary (shows the draft flow / PDF banner).
  const ali = await prisma.patient.create({
    data: {
      doctorId,
      name: "Mohammed Ali",
      dateOfBirth: d("1974-01-30"),
      sex: "MALE",
      phone: "+919811100022",
      bloodGroup: "O+",
      chronicConditions: ["Type 2 diabetes"],
    },
  });
  await prisma.dischargeSummary.create({
    data: {
      doctorId,
      patientId: ali.id,
      status: "DRAFT",
      admissionDate: d("2026-07-09"),
      dischargeDate: d("2026-07-12"),
      diagnosis: "Acute gastroenteritis with mild dehydration",
      presentingComplaint: "Loose stools and vomiting for 1 day",
      hospitalCourse:
        "Admitted with dehydration. IV fluids given, electrolytes corrected. Tolerated orals by day 2.",
      treatmentGiven: "IV fluids, ondansetron, oral rehydration.",
      conditionAtDischarge: "Stable, tolerating orals, no further vomiting.",
      medicationsAtDischarge: [
        { name: "ORS", dose: "1 sachet", frequency: "after each loose stool" },
        { name: "Probiotics", dose: "1 cap", frequency: "1-0-1", duration: "5 days" },
      ],
      followUpInstructions: "Review if symptoms recur; maintain hydration.",
    },
  });

  const [pc, ec, rc, sc] = await Promise.all([
    prisma.patient.count({ where: { doctorId } }),
    prisma.encounter.count({ where: { doctorId } }),
    prisma.prescription.count({ where: { doctorId } }),
    prisma.dischargeSummary.count({ where: { doctorId } }),
  ]);
  console.log(`Seeded: ${pc} patients, ${ec} encounters, ${rc} prescriptions, ${sc} discharge summaries.`);
  console.log("Patients: Ramesh Kumar, Sita Devi, Abdul Rahman, Lakshmi Menon, Mohammed Ali");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
