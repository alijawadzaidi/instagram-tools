import type { Metadata } from "next";

import { ExportView, meta } from "@/features/export";

export const metadata: Metadata = { title: `${meta.name} · Instagram Tools` };

export default function Page() {
  return <ExportView />;
}
