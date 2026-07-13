import Link from "next/link";
import { redirect } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getSessionDoctor } from "@/lib/web-auth";
import { LoginForm } from "./login/login-form";

export const dynamic = "force-dynamic";

// The app's front door is the sign-in screen (this deploy is the dashboard app,
// not a marketing site). Signed-in doctors skip straight to the dashboard.
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  if (await getSessionDoctor()) redirect("/dashboard");
  const { reset } = await searchParams;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6">
      {/* subtle brand backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.97_0_0),transparent)]"
      />
      <div className="relative flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Stethoscope className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Kordex Health</h1>
          <p className="text-sm text-muted-foreground">Sign in to your patient dashboard</p>
        </div>

        <Card className="shadow-md">
          <CardContent className="flex flex-col gap-3 p-5">
            {reset && (
              <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                Password updated. Sign in with your new password.
              </p>
            )}
            <LoginForm />
            <Link
              href="/forgot"
              className="text-center text-xs text-muted-foreground hover:text-foreground"
            >
              Forgot password?
            </Link>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          On Telegram? Send <span className="font-medium text-foreground">/web</span> to the bot for
          a one-tap sign-in link.
        </p>
      </div>
    </main>
  );
}
