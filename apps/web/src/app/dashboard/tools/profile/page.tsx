import type { Metadata } from "next";

import { ProfileView, meta } from "@/features/profile";

export const metadata: Metadata = { title: `${meta.name} · Instagram Tools` };

export default function Page() {
  return <ProfileView />;
}
