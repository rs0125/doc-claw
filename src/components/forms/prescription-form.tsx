"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/dashboard/patient-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { MedicationFields } from "./medication-fields";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function PrescriptionForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Date" htmlFor="date">
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </Field>
      <MedicationFields />
      <Field label="Advice" htmlFor="advice">
        <Textarea id="advice" name="advice" placeholder="Rest, fluids…" />
      </Field>
      <Field label="Follow-up date" htmlFor="followUpDate">
        <Input id="followUpDate" name="followUpDate" type="date" />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>Save prescription</SubmitButton>
    </form>
  );
}
