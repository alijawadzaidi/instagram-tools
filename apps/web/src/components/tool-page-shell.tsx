import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The centered page wrapper + icon/title/subtitle header shared by every tool
 * page (replaces 7 hand-coded header blocks). Pass the icon/title from the
 * tool's meta so they can never drift from the registry.
 */
export function ToolPageShell({
  icon: Icon,
  title,
  description,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** max-width utility for the content column, e.g. "max-w-3xl". */
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full", className)}>
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <Icon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
