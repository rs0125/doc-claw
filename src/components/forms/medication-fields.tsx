"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Med = { name: string; dose: string; frequency: string; duration: string };

const empty: Med = { name: "", dose: "", frequency: "", duration: "" };

/** Dynamic medication rows. Emits a hidden `medications` field as JSON (dropping
 * blank rows and blank duration) for the server action to validate. When
 * `required`, the first row's fields are native-required so submit needs ≥1 med. */
export function MedicationFields({ initial, required }: { initial?: Med[]; required?: boolean }) {
  const [rows, setRows] = useState<Med[]>(initial?.length ? initial : [{ ...empty }]);

  const update = (i: number, key: keyof Med, value: string) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, [key]: value } : row)));

  const payload = rows
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      dose: r.dose.trim(),
      frequency: r.frequency.trim(),
      ...(r.duration.trim() ? { duration: r.duration.trim() } : {}),
    }));

  return (
    <div className="flex flex-col gap-3">
      <Label>
        Medications
        {required && (
          <span className="ml-0.5 text-destructive" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {rows.map((row, i) => {
        const req = required && i === 0; // first row native-required → guarantees ≥1 med
        return (
          <div key={i} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Drug name"
                value={row.name}
                onChange={(e) => update(i, "name", e.target.value)}
                className="flex-1"
                required={req}
              />
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRows((r) => r.filter((_, j) => j !== i))}
                  aria-label="Remove medication"
                >
                  <X />
                </Button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Input
                placeholder="Dose (500 mg)"
                value={row.dose}
                onChange={(e) => update(i, "dose", e.target.value)}
                required={req}
              />
              <Input
                placeholder="Freq (1-0-1)"
                value={row.frequency}
                onChange={(e) => update(i, "frequency", e.target.value)}
                required={req}
              />
              <Input
                placeholder="Duration"
                value={row.duration}
                onChange={(e) => update(i, "duration", e.target.value)}
              />
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((r) => [...r, { ...empty }])}
        className="self-start"
      >
        <Plus /> Add medication
      </Button>
      <input type="hidden" name="medications" value={JSON.stringify(payload)} />
    </div>
  );
}
