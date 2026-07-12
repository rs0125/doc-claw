export const dynamic = "force-dynamic";

export default function LoginErrorPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold text-foreground">Link expired</h1>
      <p className="text-sm text-muted-foreground">
        This sign-in link has already been used or has expired. Open Telegram and send{" "}
        <span className="font-medium text-foreground">/web</span> to your bot for a fresh link.
      </p>
    </main>
  );
}
