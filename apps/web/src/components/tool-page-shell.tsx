import { cn } from "@/lib/utils";

/**
 * The centered width wrapper shared by every tool page. The tool's name lives in
 * the app bar (see `header-title.tsx`), so the page itself starts straight at
 * the input — this just constrains and centers the content column. Pass a
 * max-width utility via `className`, e.g. "max-w-3xl".
 */
export function ToolPageShell({
  className,
  children,
}: {
  /** max-width utility for the content column, e.g. "max-w-3xl". */
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("mx-auto w-full", className)}>{children}</div>;
}
