import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotForm } from "./forgot-form";

export const dynamic = "force-dynamic";

export default function ForgotPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6">
      <Link href="/" className="text-center text-lg font-semibold">
        Kordex Health
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotForm />
        </CardContent>
      </Card>
      <Link href="/" className="text-center text-xs text-muted-foreground hover:text-foreground">
        Back to sign in
      </Link>
    </main>
  );
}
