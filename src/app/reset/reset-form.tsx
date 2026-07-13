"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { resetPasswordAction } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="t" value={token} />
      <Field label="New password" htmlFor="next" required hint="At least 8 characters">
        <Input id="next" name="next" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>Set new password</SubmitButton>
    </form>
  );
}
