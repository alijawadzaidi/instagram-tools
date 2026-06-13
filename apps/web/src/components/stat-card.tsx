import { cn } from "@/lib/utils";

/** The small "big number + label" tile used by hashtags, ranking, and overview. */
export function StatCard({
  label,
  value,
  center = false,
}: {
  label: string;
  value: string | number;
  center?: boolean;
}) {
  return (
    <div className={cn("bg-muted/50 rounded-lg p-3", center && "text-center")}>
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
