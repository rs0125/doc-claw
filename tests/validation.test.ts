import { describe, expect, it } from "vitest";
import {
  encounterCreateSchema,
  listQuerySchema,
  medicationSchema,
  patientCreateSchema,
  patientUpdateSchema,
  prescriptionCreateSchema,
  summaryCreateSchema,
  summaryUpdateSchema,
} from "@/lib/validation";

describe("patientCreateSchema", () => {
  it("accepts a minimal patient", () => {
    const parsed = patientCreateSchema.parse({ name: "Ramesh Kumar" });
    expect(parsed.name).toBe("Ramesh Kumar");
  });

  it("transforms ISO dates to Date at UTC midnight", () => {
    const parsed = patientCreateSchema.parse({ name: "X", dateOfBirth: "1961-03-14" });
    expect(parsed.dateOfBirth).toBeInstanceOf(Date);
    expect(parsed.dateOfBirth!.toISOString()).toBe("1961-03-14T00:00:00.000Z");
  });

  it("rejects non-ISO date formats", () => {
    expect(() => patientCreateSchema.parse({ name: "X", dateOfBirth: "14-03-1961" })).toThrow();
    expect(() => patientCreateSchema.parse({ name: "X", dateOfBirth: "14 March 1961" })).toThrow();
  });

  it("rejects an empty name and unknown sex values", () => {
    expect(() => patientCreateSchema.parse({ name: "" })).toThrow();
    expect(() => patientCreateSchema.parse({ name: "X", sex: "M" })).toThrow();
  });

  it("validates nested medications", () => {
    expect(() =>
      patientCreateSchema.parse({
        name: "X",
        currentMedications: [{ name: "Metformin" }], // missing dose + frequency
      }),
    ).toThrow();
    const ok = patientCreateSchema.parse({
      name: "X",
      currentMedications: [{ name: "Metformin", dose: "500 mg", frequency: "1-0-1" }],
    });
    expect(ok.currentMedications).toHaveLength(1);
  });
});

describe("patientUpdateSchema", () => {
  it("accepts partial updates and rejects invalid fields inside them", () => {
    expect(patientUpdateSchema.parse({ bloodGroup: "B+" })).toEqual({ bloodGroup: "B+" });
    expect(() => patientUpdateSchema.parse({ dateOfBirth: "not-a-date" })).toThrow();
  });
});

describe("medicationSchema", () => {
  it("requires name, dose and frequency", () => {
    expect(() => medicationSchema.parse({ name: "X", dose: "5 mg" })).toThrow();
    expect(
      medicationSchema.parse({ name: "X", dose: "5 mg", frequency: "od", duration: "5 days" })
        .duration,
    ).toBe("5 days");
  });
});

describe("summary schemas", () => {
  const base = {
    admissionDate: "2026-07-01",
    dischargeDate: "2026-07-05",
    diagnosis: "CAP",
    hospitalCourse: "Improved on IV antibiotics.",
  };

  it("accepts a valid summary and transforms both dates", () => {
    const parsed = summaryCreateSchema.parse(base);
    expect(parsed.admissionDate).toBeInstanceOf(Date);
    expect(parsed.dischargeDate).toBeInstanceOf(Date);
  });

  it("requires diagnosis and hospitalCourse", () => {
    expect(() => summaryCreateSchema.parse({ ...base, diagnosis: undefined })).toThrow();
    expect(() => summaryCreateSchema.parse({ ...base, hospitalCourse: "" })).toThrow();
  });

  it("only allows DRAFT/FINAL statuses on update", () => {
    expect(summaryUpdateSchema.parse({ status: "FINAL" }).status).toBe("FINAL");
    expect(() => summaryUpdateSchema.parse({ status: "final" })).toThrow();
  });
});

describe("encounterCreateSchema", () => {
  it("requires date and complaint, accepts mixed-type vitals", () => {
    expect(() => encounterCreateSchema.parse({ complaint: "fever" })).toThrow();
    const parsed = encounterCreateSchema.parse({
      date: "2026-07-12",
      complaint: "fever",
      vitals: { bp: "130/85", pulse: 88, spo2: 97 },
    });
    expect(parsed.vitals).toEqual({ bp: "130/85", pulse: 88, spo2: 97 });
  });
});

describe("prescriptionCreateSchema", () => {
  it("requires at least one medication", () => {
    expect(() =>
      prescriptionCreateSchema.parse({ date: "2026-07-12", medications: [] }),
    ).toThrow();
    const parsed = prescriptionCreateSchema.parse({
      date: "2026-07-12",
      medications: [{ name: "Paracetamol", dose: "650 mg", frequency: "1-1-1" }],
      followUpDate: "2026-07-19",
    });
    expect(parsed.followUpDate).toBeInstanceOf(Date);
  });
});

describe("listQuerySchema", () => {
  it("applies defaults and caps the limit", () => {
    expect(listQuerySchema.parse({})).toEqual({ limit: 20, offset: 0 });
    expect(() => listQuerySchema.parse({ limit: "500" })).toThrow();
    expect(listQuerySchema.parse({ limit: "5", offset: "10" })).toEqual({ limit: 5, offset: 10 });
  });
});
