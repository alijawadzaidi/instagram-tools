/**
 * The tool registry — the single source of truth driving the sidebar and the
 * home grid. It's *derived*: each tool owns its `meta.ts`, and this file just
 * collects them in display order. Adding a tool = add its meta import to this
 * list (plus the feature folder + page). Replaces the old lib/tools.ts, which
 * was a second source of truth the pages then re-hardcoded.
 */

import type { ToolMeta } from "@/lib/tool-meta";

import { transcribeMeta } from "./transcribe/meta";
import { profileMeta } from "./profile/meta";
import { hashtagsMeta } from "./hashtags/meta";
import { overviewMeta } from "./overview/meta";
import { coverMeta } from "./cover/meta";
import { rankingMeta } from "./ranking/meta";
import { exportMeta } from "./export/meta";

export const tools: ToolMeta[] = [
  transcribeMeta,
  profileMeta,
  hashtagsMeta,
  overviewMeta,
  coverMeta,
  rankingMeta,
  exportMeta,
];

export const toolHref = (slug: string) => `/dashboard/tools/${slug}`;

export const getTool = (slug: string): ToolMeta | undefined =>
  tools.find((t) => t.slug === slug);
