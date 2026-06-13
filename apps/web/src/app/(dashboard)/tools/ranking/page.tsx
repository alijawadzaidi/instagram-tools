import type { Metadata } from "next";

import { RankingView, meta } from "@/features/ranking";

export const metadata: Metadata = { title: `${meta.name} · Instagram Tools` };

export default function Page() {
  return <RankingView />;
}
