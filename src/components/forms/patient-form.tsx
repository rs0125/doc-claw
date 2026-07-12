"use client";

import { useActionState } from "react";
import type { Patient } from "@/generated/prisma/client";
import type { FormState } from "@/app/dashboard/patient-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

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
  const dob = patient?.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : "";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Name" htmlFor="name" required>
        <Input id="name" name="name" defaultValue={patient?.name} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date of birth" htmlFor="dateOfBirth" hint="Use if exact date is known">
          <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={dob} />
        </Field>
        <Field label="Age" htmlFor="age" hint="Use if DOB unknown">
          <Input id="age" name="age" type="number" min={0} max={120} placeholder="years" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sex" htmlFor="sex">
          <select
            id="sex"
            name="sex"
            defaultValue={patient?.sex ?? "UNKNOWN"}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="UNKNOWN">—</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </Field>
        <Field label="Blood group" htmlFor="bloodGroup">
          <Input id="bloodGroup" name="bloodGroup" defaultValue={patient?.bloodGroup ?? ""} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Phone" htmlFor="phone">
          <Input id="phone" name="phone" defaultValue={patient?.phone ?? ""} />
        </Field>
        <Field label="ABHA ID" htmlFor="abhaId">
          <Input id="abhaId" name="abhaId" defaultValue={patient?.abhaId ?? ""} />
        </Field>
      </div>
      <Field label="Allergies" htmlFor="allergies" hint="Comma-separated">
        <Input
          id="allergies"
          name="allergies"
          defaultValue={patient?.allergies.join(", ")}
          placeholder="penicillin, sulfa"
        />
      </Field>
      <Field label="Chronic conditions" htmlFor="chronicConditions" hint="Comma-separated">
        <Input
          id="chronicConditions"
          name="chronicConditions"
          defaultValue={patient?.chronicConditions.join(", ")}
          placeholder="Type 2 diabetes, Hypertension"
        />
      </Field>
      <Field label="Notes" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={patient?.notes ?? ""} />
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
