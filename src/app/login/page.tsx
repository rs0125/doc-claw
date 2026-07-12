import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionDoctor } from "@/lib/web-auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionDoctor()) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6">
      <Link href="/" className="text-center text-lg font-semibold">
        Kordex Health
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Doctor sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">
        On Telegram? Send <span className="font-medium text-foreground">/web</span> to the bot for a
        one-tap sign-in link.
      </p>
    </main>
  );
}
