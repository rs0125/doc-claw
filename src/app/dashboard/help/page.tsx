import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionDoctor } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Patients",
    items: [
      "Search by name or phone at the top of the dashboard.",
      "Tap the round + button (bottom-right) to add a new patient.",
      "Open a patient to see their visits, prescriptions, surgeries and photos.",
      "Use Edit on a patient to update demographics, allergies and chronic conditions.",
    ],
  },
  {
    title: "Records",
    items: [
      "Each section (Prescriptions, Surgeries, Visits) has an Add button.",
      "Prescriptions and surgeries can be downloaded as a PDF.",
      "A draft surgery can be Finalized — after that it can't be edited.",
    ],
  },
  {
    title: "Photos & scans",
    items: [
      "Inside Prescriptions and Surgeries, use Upload photo to attach an image or PDF (e.g. a paper prescription or lab report).",
      "Uploads are stored securely and shown as thumbnails; tap one to open the full image.",
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

export default async function HelpPage() {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/dashboard"
        className="-my-2.5 inline-flex items-center gap-1 self-start py-2.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Patients
      </Link>

      <div>
        <h1 className="text-xl font-semibold">How Kordex Health works</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A quick guide to everything you can do here and in the Telegram bot.
        </p>
      </div>

      {SECTIONS.map((s) => (
        <Card key={s.title}>
          <CardHeader>
            <CardTitle className="text-base">{s.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="ml-4 list-disc space-y-1.5 text-sm text-muted-foreground">
              {s.items.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
