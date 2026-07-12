import Link from "next/link";
import { MessageCircle, FileText, ShieldCheck, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Navbar } from "@/components/navbar";
import { getSessionDoctor } from "@/lib/web-auth";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Manage patients over Telegram",
    body: "Add patients, record visits, and write prescriptions in plain language — the bot confirms every change before saving.",
  },
  {
    icon: FileText,
    title: "Instant discharge summaries",
    body: "Generate clean, structured discharge summaries and prescriptions as PDFs, shared straight to chat.",
  },
  {
    icon: Camera,
    title: "Snap & store documents",
    body: "Photograph paper prescriptions or lab reports; they're stored securely and fetched on demand.",
  },
  {
    icon: ShieldCheck,
    title: "Private by design",
    body: "Each doctor sees only their own patients. Every change is audited and every document is access-controlled.",
  },
];

export default async function Home() {
  const doctor = await getSessionDoctor();

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar signedIn={!!doctor} />

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center">
          <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            For Indian doctors
          </span>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Your patient records, a message away.
          </h1>
          <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
            Kordex Health lets you manage patients, prescriptions, and discharge summaries right from
            Telegram — with a full dashboard whenever you need it.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href={doctor ? "/dashboard" : "/login"}>
              <Button size="lg">{doctor ? "Open dashboard" : "Doctor login"}</Button>
            </Link>
            <a href="https://t.me/KordexHealthBot" target="_blank" rel="noopener noreferrer">
              <Button size="lg" variant="outline">
                <MessageCircle /> Open the Telegram bot
              </Button>
            </a>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-6 pb-20 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <f.icon className="size-5 text-muted-foreground" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.body}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-muted-foreground">
          Kordex Health · a demo build
        </div>
      </footer>
    </div>
  );
}
