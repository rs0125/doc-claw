import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionDoctor } from "@/lib/web-auth";
import { logout } from "./actions";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Link href="/dashboard" className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Kordex Health</span>
          <span className="text-xs text-muted-foreground">{doctor.name}</span>
        </Link>
        <form action={logout}>
          <Button variant="ghost" size="sm" type="submit" aria-label="Sign out">
            <LogOut />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        </form>
      </header>
      <main className="flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
