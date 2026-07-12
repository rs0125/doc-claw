"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/dashboard/patient-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function VisitForm({ action, today }: { action: Action; today: string }) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Date" htmlFor="date" required>
        <Input id="date" name="date" type="date" defaultValue={today} required />
      </Field>
      <Field label="Complaint" htmlFor="complaint" required>
        <Textarea id="complaint" name="complaint" required placeholder="Fever and cough x2 days" />
      </Field>
      <Field label="Examination" htmlFor="examination">
        <Textarea id="examination" name="examination" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="BP" htmlFor="vitals_bp">
          <Input id="vitals_bp" name="vitals_bp" placeholder="130/85" />
        </Field>
        <Field label="Pulse" htmlFor="vitals_pulse">
          <Input id="vitals_pulse" name="vitals_pulse" placeholder="78" />
        </Field>
        <Field label="Temp" htmlFor="vitals_temp">
          <Input id="vitals_temp" name="vitals_temp" placeholder="98.6 F" />
        </Field>
        <Field label="SpO2" htmlFor="vitals_spo2">
          <Input id="vitals_spo2" name="vitals_spo2" placeholder="98" />
        </Field>
      </div>
      <Field label="Diagnosis" htmlFor="diagnosis">
        <Input id="diagnosis" name="diagnosis" />
      </Field>
      <Field label="Plan" htmlFor="plan">
        <Textarea id="plan" name="plan" />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>Save visit</SubmitButton>
    </form>
  );
}
