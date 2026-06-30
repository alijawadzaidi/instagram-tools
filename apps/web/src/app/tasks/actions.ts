"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

import { isEditable, readData, writeData, type Task } from "./lib";

function assertEditable() {
  if (!isEditable) {
    throw new Error("Editing is disabled here — edit locally with `pnpm dev`, then commit & push.");
  }
}

export async function toggleTask(id: string): Promise<void> {
  assertEditable();
  const data = await readData();
  for (const phase of data.phases) {
    for (const task of phase.tasks) {
      if (task.id === id) task.done = !task.done;
    }
  }
  await writeData(data);
  revalidatePath("/tasks");
}

export async function addTask(
  phaseId: string,
  title: string,
  note: string,
  detail: string,
): Promise<void> {
  assertEditable();
  const clean = title.trim();
  if (!clean) return;
  const data = await readData();
  const phase = data.phases.find((p) => p.id === phaseId);
  if (!phase) return;
  phase.tasks.push({
    id: `t-${randomUUID().slice(0, 8)}`,
    title: clean,
    note: note.trim() || undefined,
    detail: detail.trim() || undefined,
    done: false,
  });
  await writeData(data);
  revalidatePath("/tasks");
}

export async function editTask(
  id: string,
  title: string,
  note: string,
  detail: string,
): Promise<void> {
  assertEditable();
  const clean = title.trim();
  if (!clean) return;
  const data = await readData();
  for (const phase of data.phases) {
    for (const task of phase.tasks) {
      if (task.id === id) {
        task.title = clean;
        task.note = note.trim() || undefined;
        task.detail = detail.trim() || undefined;
      }
    }
  }
  await writeData(data);
  revalidatePath("/tasks");
}

export async function removeTask(id: string): Promise<void> {
  assertEditable();
  const data = await readData();
  for (const phase of data.phases) {
    phase.tasks = phase.tasks.filter((t) => t.id !== id);
  }
  await writeData(data);
  revalidatePath("/tasks");
}

// Reorder a phase's tasks to match the given list of ids (drag-and-drop).
export async function reorderTasks(phaseId: string, orderedIds: string[]): Promise<void> {
  assertEditable();
  const data = await readData();
  const phase = data.phases.find((p) => p.id === phaseId);
  if (!phase) return;
  const byId = new Map(phase.tasks.map((t) => [t.id, t]));
  const next: Task[] = [];
  for (const id of orderedIds) {
    const t = byId.get(id);
    if (t) {
      next.push(t);
      byId.delete(id);
    }
  }
  // safety: keep any task not present in orderedIds
  for (const t of byId.values()) next.push(t);
  phase.tasks = next;
  await writeData(data);
  revalidatePath("/tasks");
}
