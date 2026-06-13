import { UserSearch } from "lucide-react";

import type { ToolMeta } from "@/lib/tool-meta";

export const profileMeta: ToolMeta = {
  slug: "profile",
  name: "Profile Reels",
  description: "Enter a username, browse their reels, and transcribe any of them.",
  icon: UserSearch,
  status: "live",
};
