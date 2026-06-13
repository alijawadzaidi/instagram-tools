/**
 * Generic async-job polling. The backend runs long work (transcription, and
 * every future AI tool) as a job: POST to start, then poll until terminal.
 * This `refetchInterval` query replaces the hand-rolled while-loop in
 * lib/api.ts's transcribeReel and never leaks an interval.
 */

import { queryOptions } from "@tanstack/react-query";

import { getJob, type JobStatus } from "@/lib/api";

const TERMINAL: JobStatus[] = ["done", "error"];

export function jobQuery(jobId: string | null) {
  return queryOptions({
    queryKey: ["job", jobId],
    queryFn: () => getJob(jobId as string),
    enabled: jobId !== null,
    // Poll every 2s while pending/running; stop once the job reaches a terminal
    // status. A terminal job is never stale, so it won't be re-polled.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL.includes(status) ? false : 2000;
    },
    staleTime: 0,
  });
}
