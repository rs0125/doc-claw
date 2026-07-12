import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function PatientLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-20" />
      <Card className="p-4">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-3 w-56" />
      </Card>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Card className="p-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-3 w-2/3" />
          </Card>
        </div>
      ))}
    </div>
  );
}
