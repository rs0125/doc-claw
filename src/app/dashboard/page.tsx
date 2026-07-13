import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, ChevronLeft, Search, UserPlus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSessionDoctor, webAuth } from "@/lib/web-auth";
import { searchPatients } from "@/services/patients";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const selectClass =
  "h-10 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ageFrom(dob: Date | null, approximate = false): string {
  if (!dob) return "";
  const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600_000));
  return `${approximate ? "~" : ""}${years}y`;
}

/** Build a dashboard URL preserving the given params (omitting empty ones). */
function href(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `/dashboard?${s}` : "/dashboard";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sex?: string; blood?: string; page?: string }>;
}) {
  const doctor = await getSessionDoctor();
  if (!doctor) redirect("/login");
  const sp = await searchParams;
  const query = sp.q?.trim() || undefined;
  const sex = sp.sex || undefined;
  const bloodGroup = sp.blood || undefined;
  const page = Math.max(parseInt(sp.page ?? "1", 10) || 1, 1);
  const filtersActive = !!(query || sex || bloodGroup);

  const { patients, total } = await searchPatients(webAuth(doctor), {
    q: query,
    sex,
    bloodGroup,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const base = { q: query, sex, blood: bloodGroup };

  // First-run empty state — no patients at all and no active filter.
  if (!filtersActive && total === 0) {
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
      {/* Search + filters — one GET form so they apply together; page resets to 1. */}
      <form className="flex flex-col gap-2" action="/dashboard" method="get">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search by name or phone"
              className="pl-9 pr-9"
              autoComplete="off"
            />
            {query && (
              <Link
                href={href({ sex, blood: bloodGroup })}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" />
              </Link>
            )}
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select name="sex" defaultValue={sex ?? ""} className={selectClass}>
            <option value="">Any sex</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <select name="blood" defaultValue={bloodGroup ?? ""} className={selectClass}>
            <option value="">Any blood group</option>
            {BLOOD_GROUPS.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" size="sm">
            Apply filters
          </Button>
          {filtersActive && (
            <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground">
              Clear all
            </Link>
          )}
        </div>
      </form>

      <p className="px-1 text-xs text-muted-foreground">
        {total} {total === 1 ? "patient" : "patients"}
        {filtersActive ? " matching" : ""}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ""}
      </p>

      <div className="flex flex-col gap-2">
        {patients.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No patients match your search or filters.
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
                  {p.bloodGroup && <Badge variant="outline">{p.bloodGroup}</Badge>}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={href({ ...base, page: page - 1 })}>
              <Button variant="outline" size="sm">
                <ChevronLeft /> Prev
              </Button>
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={href({ ...base, page: page + 1 })}>
              <Button variant="outline" size="sm">
                Next <ChevronRight />
              </Button>
            </Link>
          ) : (
            <span />
          )}
        </div>
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
