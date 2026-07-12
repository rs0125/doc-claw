import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { searchPatients } from "@/services/patients";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function ageFrom(dob: Date | null, approximate = false): string {
  if (!dob) return "";
  const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600_000));
  return `${approximate ? "~" : ""}${years}y`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; n?: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const { q, n } = await searchParams;
  const query = q?.trim() || undefined;

  // "Load more" grows the visible count via ?n=; capped for sanity.
  const shown = Math.min(Math.max(parseInt(n ?? "", 10) || PAGE_SIZE, PAGE_SIZE), 1000);

  const { patients, total } = await searchPatients(webAuth(doctor), {
    q: query,
    limit: shown,
    offset: 0,
  });
  const hasMore = !query && total > patients.length;

  // First-run empty state (no patients at all, not just an empty search).
  if (!query && total === 0) {
    return (
      <div className="flex flex-col gap-4 pb-24">
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <UserPlus className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No patients yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first patient to get started, or message the Telegram bot.
            </p>
          </div>
          <Link href="/dashboard/patients/new">
            <Button>
              <UserPlus /> Add your first patient
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <form className="flex gap-2" action="/dashboard" method="get">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search patients by name or phone"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <p className="px-1 text-xs text-muted-foreground">
        {query ? `${total} result${total === 1 ? "" : "s"} for "${query}"` : `${total} patients`}
      </p>

      <div className="flex flex-col gap-2">
        {patients.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No patients found{query ? ` for "${query}"` : ""}.
          </Card>
        )}
        {patients.map((p) => (
          <Link key={p.id} href={`/dashboard/patients/${p.id}`}>
            <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {p.sex !== "UNKNOWN" ? p.sex.toLowerCase() : ""}{" "}
                    {ageFrom(p.dateOfBirth, p.dobApproximate)}
                  </span>
                  {p.phone && <span>{p.phone}</span>}
                  {p.chronicConditions.slice(0, 2).map((c) => (
                    <Badge key={c} variant="secondary">
                      {c}
                    </Badge>
                  ))}
                </div>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Card>
          </Link>
        ))}
      </div>

      {hasMore && (
        <Link href={`/dashboard?n=${shown + PAGE_SIZE}`} className="mx-auto">
          <Button variant="outline">Load more ({total - patients.length} more)</Button>
        </Link>
      )}

      {/* Floating action button — anchored to the content column, thumb-reachable. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20">
        <div className="mx-auto flex max-w-2xl justify-end px-4">
          <Link href="/dashboard/patients/new" className="pointer-events-auto">
            <Button className="h-12 rounded-full px-5 shadow-lg">
              <UserPlus /> New patient
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
