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
    <div
      className={cn(
        "bg-soft-cloud border-hairline border p-4",
        center && "text-center",
      )}
    >
      <div className="heading-lg">{value}</div>
      <div className="caption-sm text-mute mt-0.5">{label}</div>
    </div>
  );
}
