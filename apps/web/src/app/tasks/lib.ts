import { promises as fs } from "fs";
import path from "path";

// Shared types. The committed JSON file (tasks.json) is the SOURCE OF TRUTH —
// edits made on the /tasks page (in local dev) are written back to it, so a
// `git push` shares the updated list + checkmarks with your cofounder.
export type Task = { id: string; title: string; note?: string; detail?: string; done?: boolean };
export type Phase = { id: string; title: string; subtitle?: string; tasks: Task[] };
export type TaskData = { phases: Phase[] };

// Writes only work where the filesystem is writable (your machine via `pnpm dev`).
// On a deployed host the page is read-only — display only.
export const isEditable = process.env.NODE_ENV !== "production";

// cwd is apps/web under `pnpm dev`; fall back to repo-root just in case.
const CANDIDATES = [
  path.join(process.cwd(), "src/app/tasks/tasks.json"),
  path.join(process.cwd(), "apps/web/src/app/tasks/tasks.json"),
];

async function resolveFile(): Promise<string> {
  for (const p of CANDIDATES) {
    try {
      await fs.access(p);
      return p;
    } catch {
      // try next
    }
  }
  return CANDIDATES[0];
}

export async function readData(): Promise<TaskData> {
  const file = await resolveFile();
  const raw = await fs.readFile(file, "utf8");
  return JSON.parse(raw) as TaskData;
}

export async function writeData(data: TaskData): Promise<void> {
  const file = await resolveFile();
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}
