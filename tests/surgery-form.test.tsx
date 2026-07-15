// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

// RTL auto-cleanup needs vitest globals, which this project doesn't enable.
afterEach(cleanup);
import { SurgeryForm } from "@/components/forms/surgery-form";
import type { FormState } from "@/app/dashboard/patient-actions";

/**
 * Regression test: React 19 resets a form's uncontrolled inputs to their
 * defaultValue after a form action settles — even when the action fails.
 * The fix echoes the submitted values back through FormState.values so the
 * post-action reset repopulates the form instead of wiping it.
 */

// Mirrors the server action's failure path: echo every string field back.
async function failingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") values[k] = v;
  return { error: "dischargeDate: Discharge date can't be before admission date", values };
}

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe("SurgeryForm after a failed submit", () => {
  // Control case: without the values echo, React 19's post-action reset wipes
  // the form. This proves the reset actually fires in this environment — so the
  // main test passes because of the echo, not because the reset never ran.
  it("(control) is wiped when the action does not echo values", async () => {
    const noEcho = async (): Promise<FormState> => ({ error: "boom" });
    render(<SurgeryForm action={noEcho} today="2026-07-16" />);

    fill(/diagnosis/i, "Acute appendicitis");
    fireEvent.submit(screen.getByLabelText(/diagnosis/i).closest("form")!);

    await waitFor(() => expect(screen.getByText("boom")).toBeTruthy());
    expect((screen.getByLabelText(/diagnosis/i) as HTMLInputElement).value).toBe("");
  });

  it("keeps the typed values instead of wiping the form", async () => {
    render(<SurgeryForm action={failingAction} today="2026-07-16" />);

    fill(/admission date/i, "2026-07-10");
    fill(/discharge date/i, "2026-07-01"); // before admission → action fails
    fill(/diagnosis/i, "Acute appendicitis");
    fill(/hospital course/i, "Lap appendectomy, uneventful recovery.");
    fill(/treatment given/i, "IV ceftriaxone");

    fireEvent.submit(screen.getByLabelText(/diagnosis/i).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/can't be before admission/i)).toBeTruthy();
    });

    // The post-action form reset must repopulate from the echoed values.
    expect((screen.getByLabelText(/admission date/i) as HTMLInputElement).value).toBe("2026-07-10");
    expect((screen.getByLabelText(/discharge date/i) as HTMLInputElement).value).toBe("2026-07-01");
    expect((screen.getByLabelText(/diagnosis/i) as HTMLInputElement).value).toBe("Acute appendicitis");
    expect((screen.getByLabelText(/hospital course/i) as HTMLTextAreaElement).value).toBe(
      "Lap appendectomy, uneventful recovery.",
    );
    expect((screen.getByLabelText(/treatment given/i) as HTMLTextAreaElement).value).toBe(
      "IV ceftriaxone",
    );
  });
});
