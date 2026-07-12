const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Indian-style date: day-first, e.g. "13 Jul 2026". Uses UTC (dates are stored
 * at UTC midnight) so the calendar day never shifts by timezone. */
export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Numeric Indian format DD/MM/YYYY — for compact contexts. */
export function formatDateNumeric(d: Date | null | undefined): string {
  if (!d) return "—";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}
