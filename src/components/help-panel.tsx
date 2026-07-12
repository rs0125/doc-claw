"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Patients",
    items: [
      "Search by name or phone at the top of the dashboard.",
      "Tap the round + button (bottom-right) to add a new patient.",
      "Open a patient to see their visits, prescriptions, summaries and photos.",
      "Use Edit on a patient to update demographics, allergies and chronic conditions.",
    ],
  },
  {
    title: "Records",
    items: [
      "Each section (Prescriptions, Discharge summaries, Visits) has an Add button.",
      "Prescriptions and discharge summaries can be downloaded as a PDF.",
      "A draft discharge summary can be Finalized — after that it can't be edited.",
    ],
  },
  {
    title: "Photos & scans",
    items: [
      "Upload a photo of a paper prescription, lab report or scan from the patient page.",
      "Pick a type, then Upload photo — it's stored securely and shown as a thumbnail.",
      "Tap a thumbnail to open the full image.",
    ],
  },
  {
    title: "Telegram",
    items: [
      "Go to Account to connect a Telegram chat — you'll get a one-time code to send the bot.",
      "In the bot you can manage patients by chatting, or use /find, /add, /prescribe, /web.",
      "/web sends a one-tap link back into this dashboard.",
      "Revoke access from Account to disconnect a chat; it's notified and the code is reset.",
    ],
  },
];

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <HelpCircle />
        Help
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="How Kordex Health works">
        <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto text-sm">
          {SECTIONS.map((s) => (
            <div key={s.title} className="flex flex-col gap-1.5">
              <h3 className="font-semibold">{s.title}</h3>
              <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                {s.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
