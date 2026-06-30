import type { Metadata } from "next";

import { HashtagsView, meta } from "@/features/hashtags";

export const metadata: Metadata = { title: `${meta.name} · Instagram Tools` };

export default function Page() {
  return <HashtagsView />;
}
