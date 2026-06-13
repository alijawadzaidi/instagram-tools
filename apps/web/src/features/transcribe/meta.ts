import { AudioLines } from "lucide-react";

import type { ToolMeta } from "@/lib/tool-meta";

export const transcribeMeta: ToolMeta = {
  slug: "transcribe",
  name: "Reel Transcriber",
  description: "Paste an Instagram reel link and get its spoken words as text.",
  icon: AudioLines,
  status: "live",
};
