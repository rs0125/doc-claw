"use client";

import { useActionState } from "react";
import type { Encounter } from "@/generated/prisma/client";
import type { FormState } from "@/app/dashboard/patient-actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "./submit-button";
import { FormError } from "./form-error";

type Action = (prev: FormState, fd: FormData) => Promise<FormState>;

export function VisitForm({
  action,
  today,
  encounter,
  submitLabel = "Save visit",
}: {
  action: Action;
  today: string;
  encounter?: Encounter;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const vit = (encounter?.vitals ?? {}) as Record<string, string | number>;
  const dateVal = encounter ? encounter.date.toISOString().slice(0, 10) : today;
  // On a failed submit, prefer what the doctor just typed over the saved record.
  const v = state.values;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Date" htmlFor="date" required>
        <Input id="date" name="date" type="date" defaultValue={v?.date ?? dateVal} required />
      </Field>
      <Field label="Complaint" htmlFor="complaint" required>
        <Textarea
          id="complaint"
          name="complaint"
          required
          defaultValue={v?.complaint ?? encounter?.complaint}
          placeholder="Fever and cough x2 days"
        />
      </Field>
      <Field label="Examination" htmlFor="examination">
        <Textarea id="examination" name="examination" defaultValue={v?.examination ?? encounter?.examination ?? ""} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="BP" htmlFor="vitals_bp">
          <Input id="vitals_bp" name="vitals_bp" defaultValue={v?.vitals_bp ?? String(vit.bp ?? "")} placeholder="130/85" />
        </Field>
        <Field label="Pulse" htmlFor="vitals_pulse">
          <Input id="vitals_pulse" name="vitals_pulse" defaultValue={v?.vitals_pulse ?? String(vit.pulse ?? "")} placeholder="78" />
        </Field>
        <Field label="Temp" htmlFor="vitals_temp">
          <Input id="vitals_temp" name="vitals_temp" defaultValue={v?.vitals_temp ?? String(vit.temp ?? "")} placeholder="98.6 F" />
        </Field>
        <Field label="SpO2" htmlFor="vitals_spo2">
          <Input id="vitals_spo2" name="vitals_spo2" defaultValue={v?.vitals_spo2 ?? String(vit.spo2 ?? "")} placeholder="98" />
        </Field>
      </div>
      <Field label="Diagnosis" htmlFor="diagnosis">
        <Input id="diagnosis" name="diagnosis" defaultValue={v?.diagnosis ?? encounter?.diagnosis ?? ""} />
      </Field>
      <Field label="Plan" htmlFor="plan">
        <Textarea id="plan" name="plan" defaultValue={v?.plan ?? encounter?.plan ?? ""} />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
