import { Image } from "lucide-react";

import type { ToolMeta } from "@/lib/tool-meta";

export const coverMeta: ToolMeta = {
  slug: "cover",
  name: "Cover Downloader",
  description: "Download the full-resolution cover image of any reel or post.",
  icon: Image,
  status: "live",
};
