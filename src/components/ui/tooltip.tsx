import { cn } from "@/lib/cn";

/**
 * Pure-CSS hover tooltip (no deps, server-safe). Wrap any control:
 *   <Tooltip label="Download PDF"><a …>…</a></Tooltip>
 * Hover-only, so pair with the Help panel for touch users.
 */
export function Tooltip({
  label,
  side = "top",
  children,
}: {
  label: string;
  side?: "top" | "bottom";
  children: React.ReactNode;
}) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground shadow-sm group-hover/tt:block",
          side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
        )}
      >
        {label}
      </span>
    </span>
  );
}
