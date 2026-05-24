import { AudioLines, UserSearch, Hash, type LucideIcon } from "lucide-react";

/**
 * The tool registry — the single source of truth for the whole app.
 *
 * Both the sidebar and the home page render from this list. To add a new tool:
 *   1. add an entry here,
 *   2. create a page at `app/(dashboard)/tools/<slug>/page.tsx`.
 * That's it — it shows up in the sidebar and on the home grid automatically.
 */
export type ToolStatus = "live" | "soon";

export interface Tool {
  /** URL-safe id; also the route segment under /tools/<slug>. */
  slug: string;
  name: string;
  /** One-line description shown on cards and tooltips. */
  description: string;
  icon: LucideIcon;
  status: ToolStatus;
}

export const tools: Tool[] = [
  {
    slug: "transcribe",
    name: "Reel Transcriber",
    description: "Paste an Instagram reel link and get its spoken words as text.",
    icon: AudioLines,
    status: "live",
  },
  {
    slug: "profile",
    name: "Profile Reels",
    description: "Enter a username, browse their reels, and transcribe any of them.",
    icon: UserSearch,
    status: "live",
  },
  {
    slug: "hashtags",
    name: "Hashtag Research",
    description: "Analyze an account's most-used hashtags and the combinations they pair.",
    icon: Hash,
    status: "live",
  },
  // Future tools land here, e.g.:
  // { slug: "caption", name: "Caption Writer", description: "...", icon: PenLine, status: "soon" },
];

export const toolHref = (slug: string) => `/tools/${slug}`;

export const getTool = (slug: string): Tool | undefined =>
  tools.find((t) => t.slug === slug);
