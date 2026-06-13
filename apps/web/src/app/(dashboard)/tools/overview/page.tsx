import type { Metadata } from "next";

import { OverviewView, meta } from "@/features/overview";

export const metadata: Metadata = { title: `${meta.name} · Instagram Tools` };

export default function Page() {
  return <OverviewView />;
}
