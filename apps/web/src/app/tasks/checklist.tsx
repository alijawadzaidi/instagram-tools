"use client";

import { useState, useTransition } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Phase, Task } from "./lib";
import { addTask, editTask, removeTask, reorderTasks, toggleTask } from "./actions";

type Run = (fn: () => Promise<void>) => void;

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {done}/{total}
      </span>
    </div>
  );
}

function TaskRow({
  task,
  editable,
  pending,
  run,
}: {
  task: Task;
  editable: boolean;
  pending: boolean;
  run: Run;
}) {
  const { id, title, note, detail, done } = task;
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftNote, setDraftNote] = useState(note ?? "");
  const [draftDetail, setDraftDetail] = useState(detail ?? "");

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-input px-3 py-2">
        <Input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} placeholder="Task" autoFocus />
        <Input value={draftNote} onChange={(e) => setDraftNote(e.target.value)} placeholder="Short note (optional)" />
        <Textarea
          value={draftDetail}
          onChange={(e) => setDraftDetail(e.target.value)}
          placeholder="Detail — what this task is and why it matters (optional)"
          rows={4}
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              run(() => editTask(id, draftTitle, draftNote, draftDetail));
              setEditing(false);
            }}
          >
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start gap-1 px-1 py-2">
        {editable ? (
          <span
            className="mt-0.5 cursor-grab select-none px-1 text-muted-foreground/50 active:cursor-grabbing"
            title="Drag to reorder"
            aria-hidden
          >
            ⠿
          </span>
        ) : null}
        <button
          type="button"
          disabled={!editable || pending}
          onClick={() => run(() => toggleTask(id))}
          className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-not-allowed"
        >
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border text-xs",
              done ? "border-primary bg-primary text-primary-foreground" : "border-input",
            )}
            aria-hidden
          >
            {done ? "✓" : ""}
          </span>
          <span className="min-w-0">
            <span className={cn("block text-sm", done && "text-muted-foreground line-through")}>{title}</span>
            {note ? <span className="block text-xs text-muted-foreground">{note}</span> : null}
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {detail ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              {expanded ? "Hide" : "Why?"}
            </Button>
          ) : null}
          {editable ? (
            <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  setDraftTitle(title);
                  setDraftNote(note ?? "");
                  setDraftDetail(detail ?? "");
                  setEditing(true);
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                title="Delete"
                onClick={() => {
                  if (window.confirm(`Delete "${title}"?`)) run(() => removeTask(id));
                }}
              >
                ✕
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {expanded && detail ? (
        <p className="ml-10 mr-2 mb-2 border-l-2 border-muted pl-3 text-xs leading-relaxed text-muted-foreground">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function PhaseList({
  phase,
  editable,
  pending,
  run,
}: {
  phase: Phase;
  editable: boolean;
  pending: boolean;
  run: Run;
}) {
  // Optimistic order; re-sync from props (render-phase pattern) when the server
  // sends a new order, instead of a set-state-in-effect.
  const propIds = phase.tasks.map((t) => t.id).join("|");
  const [order, setOrder] = useState<string[]>(() => phase.tasks.map((t) => t.id));
  const [prevIds, setPrevIds] = useState(propIds);
  if (propIds !== prevIds) {
    setPrevIds(propIds);
    setOrder(phase.tasks.map((t) => t.id));
  }

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const byId = new Map(phase.tasks.map((t) => [t.id, t]));
  const tasks = order.map((id) => byId.get(id)).filter((t): t is Task => Boolean(t));

  const apply = (next: string[]) => {
    setOrder(next);
    setDraggingId(null);
    setOverId(null);
    run(() => reorderTasks(phase.id, next));
  };

  const dropBefore = (targetId: string) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setOverId(null);
      return;
    }
    const without = order.filter((id) => id !== draggingId);
    const idx = without.indexOf(targetId);
    without.splice(idx, 0, draggingId);
    apply(without);
  };

  const dropEnd = () => {
    if (!draggingId) return;
    apply([...order.filter((id) => id !== draggingId), draggingId]);
  };

  return (
    <CardContent className="space-y-0.5">
      {tasks.map((task) => (
        <div
          key={task.id}
          draggable={editable}
          onDragStart={() => setDraggingId(task.id)}
          onDragEnd={() => {
            setDraggingId(null);
            setOverId(null);
          }}
          onDragOver={(e) => {
            if (draggingId) {
              e.preventDefault();
              setOverId(task.id);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropBefore(task.id);
          }}
          className={cn(
            "group rounded-md hover:bg-muted/60",
            overId === task.id && draggingId && draggingId !== task.id && "border-t-2 border-primary",
            draggingId === task.id && "opacity-40",
          )}
        >
          <TaskRow task={task} editable={editable} pending={pending} run={run} />
        </div>
      ))}
      {editable ? (
        <div
          onDragOver={(e) => {
            if (draggingId) {
              e.preventDefault();
              setOverId("__end");
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropEnd();
          }}
          className={cn("pt-1", overId === "__end" && draggingId && "border-t-2 border-primary")}
        >
          <AddTask phaseId={phase.id} run={run} />
        </div>
      ) : null}
    </CardContent>
  );
}

function AddTask({ phaseId, run }: { phaseId: string; run: Run }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [detail, setDetail] = useState("");

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        + Add task
      </Button>
    );
  }

  const submit = () => {
    if (!title.trim()) return;
    run(() => addTask(phaseId, title, note, detail));
    setTitle("");
    setNote("");
    setDetail("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed border-input px-3 py-2">
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New task" autoFocus />
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short note (optional)" />
      <Textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Detail — what this task is and why it matters (optional)"
        rows={3}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={submit}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export function Checklist({ phases, editable }: { phases: Phase[]; editable: boolean }) {
  const [pending, startTransition] = useTransition();
  const run: Run = (fn) => startTransition(() => void fn());

  const allTasks = phases.flatMap((p) => p.tasks);
  const totalDone = allTasks.filter((t) => t.done).length;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <header className="space-y-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Build checklist</h1>
          <p className="text-sm text-muted-foreground">
            Saved to <code className="rounded bg-muted px-1 py-0.5 text-xs">app/tasks/tasks.json</code> — commit
            &amp; push to share. Drag <span className="text-foreground">⠿</span> to reorder; click{" "}
            <em>Why?</em> for detail.
          </p>
        </div>
        <ProgressBar done={totalDone} total={allTasks.length} />
        {!editable ? (
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            Read-only here. Run the app locally (<code>pnpm dev</code>) to check off / edit / reorder, then commit
            &amp; push.
          </p>
        ) : null}
      </header>

      {phases.map((phase) => {
        const phaseDone = phase.tasks.filter((t) => t.done).length;
        return (
          <Card key={phase.id} className={cn(pending && "opacity-70")}>
            <CardHeader className="gap-2">
              <div className="flex items-baseline justify-between gap-4">
                <CardTitle className="text-base">{phase.title}</CardTitle>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {phaseDone}/{phase.tasks.length}
                </span>
              </div>
              {phase.subtitle ? <p className="text-xs text-muted-foreground">{phase.subtitle}</p> : null}
            </CardHeader>
            <PhaseList phase={phase} editable={editable} pending={pending} run={run} />
          </Card>
        );
      })}
    </div>
  );
}
