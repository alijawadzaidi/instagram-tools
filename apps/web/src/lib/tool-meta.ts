import type { LucideIcon } from "lucide-react";

/** A tool's registry entry — the shape every `features/<slug>/meta.ts` exports. */
export type ToolStatus = "live" | "soon";

export interface ToolMeta {
  /** URL-safe id; also the route segment under /tools/<slug>. */
  slug: string;
  name: string;
  /** One-line description shown on the home grid and sidebar tooltips. */
  description: string;
  icon: LucideIcon;
  status: ToolStatus;
}
