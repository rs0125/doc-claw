"use client";

import { useActionState } from "react";
import type { Prescription } from "@/generated/prisma/client";
import type { FormState } from "@/app/dashboard/patient-actions";
import type { Medication } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { MedicationFields } from "./medication-fields";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function PrescriptionForm({
  action,
  today,
  prescription,
  submitLabel = "Save prescription",
}: {
  action: Action;
  today: string;
  prescription?: Prescription;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values;
  const dateVal = prescription ? prescription.date.toISOString().slice(0, 10) : today;
  const followUp = prescription?.followUpDate
    ? prescription.followUpDate.toISOString().slice(0, 10)
    : "";
  const meds = (prescription?.medications ?? undefined) as Medication[] | undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Date" htmlFor="date" required>
        <Input id="date" name="date" type="date" defaultValue={v?.date ?? dateVal} required />
      </Field>
      <MedicationFields required initial={meds} />
      <Field label="Advice" htmlFor="advice">
        <Textarea id="advice" name="advice" defaultValue={v?.advice ?? prescription?.advice ?? ""} placeholder="Rest, fluids…" />
      </Field>
      <Field label="Follow-up date" htmlFor="followUpDate">
        <Input id="followUpDate" name="followUpDate" type="date" defaultValue={v?.followUpDate ?? followUp} />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
