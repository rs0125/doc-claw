"use client";

import { useActionState } from "react";
import type { Surgery } from "@/generated/prisma/client";
import type { FormState } from "@/app/dashboard/patient-actions";
import type { Medication } from "@/lib/validation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { MedicationFields } from "./medication-fields";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

const iso = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export function SurgeryForm({
  action,
  today,
  surgery,
  submitLabel = "Save draft surgery",
}: {
  action: Action;
  today: string;
  surgery?: Surgery;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const meds = (surgery?.medicationsAtDischarge ?? undefined) as Medication[] | undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Admission date" htmlFor="admissionDate" required>
          <Input id="admissionDate" name="admissionDate" type="date" required defaultValue={iso(surgery?.admissionDate)} />
        </Field>
        <Field label="Discharge date" htmlFor="dischargeDate" required>
          <Input id="dischargeDate" name="dischargeDate" type="date" required defaultValue={iso(surgery?.dischargeDate) || today} />
        </Field>
      </div>
      <Field label="Diagnosis" htmlFor="diagnosis" required>
        <Input id="diagnosis" name="diagnosis" required defaultValue={surgery?.diagnosis ?? ""} />
      </Field>
      <Field label="Presenting complaint" htmlFor="presentingComplaint">
        <Textarea id="presentingComplaint" name="presentingComplaint" defaultValue={surgery?.presentingComplaint ?? ""} />
      </Field>
      <Field label="Hospital course" htmlFor="hospitalCourse" required>
        <Textarea id="hospitalCourse" name="hospitalCourse" required defaultValue={surgery?.hospitalCourse ?? ""} />
      </Field>
      <Field label="Investigations" htmlFor="investigations">
        <Textarea id="investigations" name="investigations" defaultValue={surgery?.investigations ?? ""} />
      </Field>
      <Field label="Treatment given" htmlFor="treatmentGiven">
        <Textarea id="treatmentGiven" name="treatmentGiven" defaultValue={surgery?.treatmentGiven ?? ""} />
      </Field>
      <Field label="Condition at discharge" htmlFor="conditionAtDischarge">
        <Input id="conditionAtDischarge" name="conditionAtDischarge" defaultValue={surgery?.conditionAtDischarge ?? ""} />
      </Field>
      <MedicationFields initial={meds} />
      <Field label="Follow-up instructions" htmlFor="followUpInstructions">
        <Textarea id="followUpInstructions" name="followUpInstructions" defaultValue={surgery?.followUpInstructions ?? ""} />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
