import type { Metadata } from "next";

import { TranscribeView, meta } from "@/features/transcribe";

export const metadata: Metadata = { title: `${meta.name} · Instagram Tools` };

export default function Page() {
  return <TranscribeView />;
}
