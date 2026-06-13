"use client";

import * as React from "react";
import { toast } from "sonner";

import { transcribeReel, type JobStatus, type ReelSummary } from "@/lib/api";

export type ReelState = {
  status: JobStatus | "idle";
  text?: string;
  error?: string;
};

const MAX_CONCURRENCY = 2; // be gentle: don't hammer Instagram / the CPU at once

/**
 * Concurrency-limited batch transcription. Real logic that doesn't fit a plain
 * query (a worker pool over N reels, each its own start+poll job), so it's a
 * feature hook rather than a shared query factory — see Architecture/04.
 *
 * NOTE: still uses lib/api's transcribeReel start-and-poll helper. Moving each
 * reel onto the jobQuery polling layer is future cleanup; the pool semantics
 * are what matters here.
 */
export function useBatchTranscribe() {
  const [states, setStates] = React.useState<Record<string, ReelState>>({});
  const [transcribing, setTranscribing] = React.useState(false);

  const reset = React.useCallback(() => setStates({}), []);

  const run = React.useCallback(async (queue: ReelSummary[]) => {
    if (queue.length === 0) return;

    setTranscribing(true);
    setStates((s) => {
      const next = { ...s };
      for (const r of queue) next[r.shortcode] = { status: "pending" };
      return next;
    });

    const setOne = (shortcode: string, patch: ReelState) =>
      setStates((s) => ({ ...s, [shortcode]: patch }));

    let cursor = 0;
    async function worker() {
      while (cursor < queue.length) {
        const reel = queue[cursor++];
        try {
          const result = await transcribeReel(reel.url, {
            onStatus: (status) => setOne(reel.shortcode, { status }),
          });
          setOne(reel.shortcode, { status: "done", text: result.text });
        } catch (err) {
          setOne(reel.shortcode, {
            status: "error",
            error: err instanceof Error ? err.message : "Failed",
          });
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, worker),
    );
    setTranscribing(false);
    toast.success(`Finished transcribing ${queue.length} reel(s).`);
  }, []);

  return { states, transcribing, run, reset };
}
