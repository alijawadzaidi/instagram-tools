import type { Metadata } from "next";

import { CoverView, meta } from "@/features/cover";

export const metadata: Metadata = { title: `${meta.name} · Instagram Tools` };

export default function Page() {
  return <CoverView />;
}
