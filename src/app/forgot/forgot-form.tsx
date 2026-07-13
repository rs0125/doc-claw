"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormError } from "@/components/forms/form-error";
import { forgotPasswordAction } from "./actions";

export function ForgotForm() {
  const [state, action] = useActionState(forgotPasswordAction, {});

  if (state.done) {
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-foreground">
          If an account exists for that email with Telegram connected, we&apos;ve sent a reset link
          to that Telegram chat. Open the bot to continue.
        </p>
        <p className="text-xs text-muted-foreground">
          Never connected Telegram? Ask your administrator to reset your password.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Enter your email and we&apos;ll send a reset link to your connected Telegram chat.
      </p>
      <Field label="Email" htmlFor="email" required>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <FormError error={state.error} />
      <SubmitButton>Send reset link</SubmitButton>
    </form>
  );
}
