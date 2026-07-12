import Link from "next/link";
import { ChevronRight, Search, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { searchPatients } from "@/services/patients";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function ageFrom(dob: Date | null): string {
  if (!dob) return "";
  const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600_000));
  return `${years}y`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login/error");
  const { q } = await searchParams;

  const { patients, total } = await searchPatients(webAuth(doctor), {
    q: q?.trim() || undefined,
    limit: 50,
    offset: 0,
  });

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
        {q ? `${total} result${total === 1 ? "" : "s"} for "${q}"` : `${total} patients`}
      </p>

      <div className="flex flex-col gap-2">
        {patients.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No patients found{q ? ` for "${q}"` : ""}.
          </Card>
        )}
        {patients.map((p) => (
          <Link key={p.id} href={`/dashboard/patients/${p.id}`}>
            <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:bg-accent">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {p.sex !== "UNKNOWN" ? p.sex.toLowerCase() : ""} {ageFrom(p.dateOfBirth)}
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
