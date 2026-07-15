"use client";

import { useActionState, useState } from "react";
import type { Patient } from "@/generated/prisma/client";
import type { FormState } from "@/app/dashboard/patient-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Whole years since an ISO date, or null if unparseable / in the future. */
function yearsSince(iso: string): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t) || t > Date.now()) return null;
  return Math.floor((Date.now() - t) / (365.25 * 24 * 3600_000));
}

export function PatientForm({
  action,
  patient,
  submitLabel,
}: {
  action: Action;
  patient?: Patient;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  // On a failed submit, prefer what the doctor just typed over the saved record.
  const v = state.values;
  // An approximate DOB is synthetic (derived from an age), so the edit form
  // round-trips it as an age instead of presenting it as an exact date.
  const exactDob =
    patient?.dateOfBirth && !patient.dobApproximate
      ? patient.dateOfBirth.toISOString().slice(0, 10)
      : "";
  const [dob, setDob] = useState(exactDob);
  const [age, setAge] = useState(() => {
    if (!patient?.dateOfBirth || !patient.dobApproximate) return "";
    return String(yearsSince(patient.dateOfBirth.toISOString()) ?? "");
  });
  const inferredAge = dob ? yearsSince(dob) : null;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="name" required>
        <Input id="name" name="name" defaultValue={v?.name ?? patient?.name} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth" htmlFor="dateOfBirth" hint="Use if exact date is known">
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
        </Field>
        <Field
          label="Age"
          htmlFor="age"
          hint={inferredAge !== null ? "Calculated from date of birth" : "Use if DOB unknown"}
        >
          <Input
            id="age"
            name="age"
            type="number"
            min={0}
            max={120}
            placeholder="years"
            value={inferredAge ?? age}
            onChange={(e) => setAge(e.target.value)}
            readOnly={inferredAge !== null}
            className={inferredAge !== null ? "bg-muted text-muted-foreground" : ""}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sex" htmlFor="sex">
          <select
            id="sex"
            name="sex"
            defaultValue={v?.sex ?? patient?.sex ?? "UNKNOWN"}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="UNKNOWN">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Blood group" htmlFor="bloodGroup">
          <Input id="bloodGroup" name="bloodGroup" defaultValue={v?.bloodGroup ?? patient?.bloodGroup ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={v?.phone ?? patient?.phone ?? ""} />
        </Field>
        <Field label="ABHA ID" htmlFor="abhaId">
          <Input id="abhaId" name="abhaId" defaultValue={v?.abhaId ?? patient?.abhaId ?? ""} />
        </Field>
      </div>
      <Field label="Allergies" htmlFor="allergies" hint="Comma-separated">
        <Input
          id="allergies"
          name="allergies"
          defaultValue={v?.allergies ?? patient?.allergies.join(", ")}
          placeholder="penicillin, sulfa"
        />
      </Field>
      <Field label="Chronic conditions" htmlFor="chronicConditions" hint="Comma-separated">
        <Input
          id="chronicConditions"
          name="chronicConditions"
          defaultValue={v?.chronicConditions ?? patient?.chronicConditions.join(", ")}
          placeholder="Type 2 diabetes, Hypertension"
        />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={v?.notes ?? patient?.notes ?? ""} />
      </Field>
      <FormError error={state.error} />
      {state.duplicate ? (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
          <p className="text-sm text-foreground">{state.duplicate}</p>
          {/* Second submit carries force=1 to bypass the duplicate guard. */}
          <Button type="submit" name="force" value="1" variant="outline">
            Add anyway
          </Button>
        </div>
      ) : (
        <SubmitButton>{submitLabel}</SubmitButton>
      )}
    </form>
  );
}
