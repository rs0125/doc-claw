import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isResetTokenValid } from "@/lib/password-reset";
import { ResetForm } from "./reset-form";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  // Read-only validity check — does NOT consume the token (crawlers/previews
  // that fetch this GET won't burn it; the POST consumes it).
  const valid = t ? await isResetTokenValid(t) : false;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6">
      <Link href="/" className="text-center text-lg font-semibold">
        Kordex Health
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
        </CardHeader>
        <CardContent>
          {valid ? (
            <ResetForm token={t!} />
          ) : (
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <p>This reset link is invalid, expired, or already used.</p>
              <Link href="/forgot" className="font-medium text-foreground underline">
                Request a new reset link
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
