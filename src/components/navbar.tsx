import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Public navbar for the landing page. Shows Dashboard if signed in, else Login. */
export function Navbar({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-base font-semibold">
          Kordex&nbsp;Health
        </Link>
        <nav className="flex items-center gap-2">
          {signedIn ? (
            <Link href="/dashboard">
              <Button size="sm">Dashboard</Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
