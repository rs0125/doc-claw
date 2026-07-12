"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";

type Variant = "default" | "outline" | "secondary" | "ghost" | "destructive";

/**
 * A button that opens a confirmation modal, then submits a bound server action.
 * Used for irreversible/destructive actions (archive, delete, finalize).
 */
export function ConfirmButton({
  action,
  trigger,
  triggerVariant = "ghost",
  triggerClassName,
  title,
  message,
  confirmLabel,
  confirmVariant = "destructive",
}: {
  action: () => Promise<void>;
  trigger: React.ReactNode;
  triggerVariant?: Variant;
  triggerClassName?: string;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: Variant;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        size="sm"
        className={cn(triggerClassName)}
        onClick={() => setOpen(true)}
      >
        {trigger}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-muted-foreground">{message}</p>
          <form action={action} className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <ConfirmSubmit label={confirmLabel} variant={confirmVariant} />
          </form>
        </div>
      </Modal>
    </>
  );
}

function ConfirmSubmit({ label, variant }: { label: string; variant: Variant }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}
