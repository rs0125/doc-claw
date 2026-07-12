"use client";

import { useActionState } from "react";
import type { DischargeSummary } from "@/generated/prisma/client";
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

export function SummaryForm({
  action,
  today,
  summary,
  submitLabel = "Save draft summary",
}: {
  action: Action;
  today: string;
  summary?: DischargeSummary;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const meds = (summary?.medicationsAtDischarge ?? undefined) as Medication[] | undefined;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Admission date" htmlFor="admissionDate" required>
          <Input id="admissionDate" name="admissionDate" type="date" required defaultValue={iso(summary?.admissionDate)} />
        </Field>
        <Field label="Discharge date" htmlFor="dischargeDate" required>
          <Input id="dischargeDate" name="dischargeDate" type="date" required defaultValue={iso(summary?.dischargeDate) || today} />
        </Field>
      </div>
      <Field label="Diagnosis" htmlFor="diagnosis" required>
        <Input id="diagnosis" name="diagnosis" required defaultValue={summary?.diagnosis ?? ""} />
      </Field>
      <Field label="Presenting complaint" htmlFor="presentingComplaint">
        <Textarea id="presentingComplaint" name="presentingComplaint" defaultValue={summary?.presentingComplaint ?? ""} />
      </Field>
      <Field label="Hospital course" htmlFor="hospitalCourse" required>
        <Textarea id="hospitalCourse" name="hospitalCourse" required defaultValue={summary?.hospitalCourse ?? ""} />
      </Field>
      <Field label="Investigations" htmlFor="investigations">
        <Textarea id="investigations" name="investigations" defaultValue={summary?.investigations ?? ""} />
      </Field>
      <Field label="Treatment given" htmlFor="treatmentGiven">
        <Textarea id="treatmentGiven" name="treatmentGiven" defaultValue={summary?.treatmentGiven ?? ""} />
      </Field>
      <Field label="Condition at discharge" htmlFor="conditionAtDischarge">
        <Input id="conditionAtDischarge" name="conditionAtDischarge" defaultValue={summary?.conditionAtDischarge ?? ""} />
      </Field>
      <MedicationFields initial={meds} />
      <Field label="Follow-up instructions" htmlFor="followUpInstructions">
        <Textarea id="followUpInstructions" name="followUpInstructions" defaultValue={summary?.followUpInstructions ?? ""} />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
