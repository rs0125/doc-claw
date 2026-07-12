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

export function SummaryForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Admission date" htmlFor="admissionDate">
          <Input id="admissionDate" name="admissionDate" type="date" required />
        </Field>
        <Field label="Discharge date" htmlFor="dischargeDate">
          <Input id="dischargeDate" name="dischargeDate" type="date" defaultValue={today} required />
        </Field>
      </div>
      <Field label="Diagnosis" htmlFor="diagnosis">
        <Input id="diagnosis" name="diagnosis" required />
      </Field>
      <Field label="Presenting complaint" htmlFor="presentingComplaint">
        <Textarea id="presentingComplaint" name="presentingComplaint" />
      </Field>
      <Field label="Hospital course" htmlFor="hospitalCourse">
        <Textarea id="hospitalCourse" name="hospitalCourse" required />
      </Field>
      <Field label="Investigations" htmlFor="investigations">
        <Textarea id="investigations" name="investigations" />
      </Field>
      <Field label="Treatment given" htmlFor="treatmentGiven">
        <Textarea id="treatmentGiven" name="treatmentGiven" />
      </Field>
      <Field label="Condition at discharge" htmlFor="conditionAtDischarge">
        <Input id="conditionAtDischarge" name="conditionAtDischarge" />
      </Field>
      <MedicationFields />
      <Field label="Follow-up instructions" htmlFor="followUpInstructions">
        <Textarea id="followUpInstructions" name="followUpInstructions" />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>Save draft summary</SubmitButton>
    </form>
  );
}
