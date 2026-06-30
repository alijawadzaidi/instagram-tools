import type { Metadata } from "next";

import { Checklist } from "./checklist";
import { isEditable, readData } from "./lib";

export const metadata: Metadata = {
  title: "Tasks",
  robots: { index: false, follow: false },
};

// Always read fresh from the committed JSON file (no caching) so edits + pushes
// are reflected immediately.
export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const data = await readData();
  return <Checklist phases={data.phases} editable={isEditable} />;
}
