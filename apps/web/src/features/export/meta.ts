import { FileDown } from "lucide-react";

import type { ToolMeta } from "@/lib/tool-meta";

export const exportMeta: ToolMeta = {
  slug: "export",
  name: "Bulk Export",
  description:
    "Export a profile's reels (link, date, views, hashtags, caption) to CSV or Markdown.",
  icon: FileDown,
  status: "live",
};
