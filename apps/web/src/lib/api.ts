/**
 * Typed client for the Python backend (apps/api).
 *
 * The backend runs transcription as a background job to avoid request timeouts
 * (a long reel can take a while). So the flow is: POST to start a job, then poll
 * the job until it's done. See Architecture/02-transcriber-design.md.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type TranscribeEngine = "local_whisper" | "openai" | "assemblyai";

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  language?: string;
}

export type JobStatus = "pending" | "running" | "done" | "error";

export interface Job {
  job_id: string;
  status: JobStatus;
  result?: TranscriptResult;
  /** Machine-readable error code, e.g. "private", "rate_limited", "no_audio". */
  error_code?: string;
  /** Human-readable error message. */
  error?: string;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? body.error ?? detail;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

/** Start a transcription job. Returns immediately with a job id. */
export function startTranscription(
  url: string,
  engine?: TranscribeEngine,
): Promise<Job> {
  return http<Job>("/tools/transcribe", {
    method: "POST",
    body: JSON.stringify({ url, engine }),
  });
}

export function getJob(jobId: string): Promise<Job> {
  return http<Job>(`/tools/transcribe/${jobId}`);
}

// --- profile reels ---

export interface ReelSummary {
  shortcode: string;
  url: string;
  thumbnail_url: string | null;
  caption: string;
  view_count: number | null;
}

export interface ProfileReelsResponse {
  username: string;
  reels: ReelSummary[];
  next_cursor: string | null; // null when there are no more reels
}

/**
 * Fetch one page of a user's reels. Omit `cursor` for the first page; pass the
 * `next_cursor` from the previous response to load the next page.
 */
export function fetchProfileReels(
  username: string,
  cursor?: string | null,
  pageSize = 12,
): Promise<ProfileReelsResponse> {
  return http<ProfileReelsResponse>("/tools/profile/reels", {
    method: "POST",
    body: JSON.stringify({ username, cursor: cursor ?? null, page_size: pageSize }),
  });
}

/**
 * Convenience: start a job and poll until it finishes (or errors).
 * Calls `onStatus` whenever the status changes so the UI can show progress.
 */
export async function transcribeReel(
  url: string,
  opts: {
    engine?: TranscribeEngine;
    onStatus?: (status: JobStatus) => void;
    signal?: AbortSignal;
    intervalMs?: number;
  } = {},
): Promise<TranscriptResult> {
  const { engine, onStatus, signal, intervalMs = 2000 } = opts;

  const started = await startTranscription(url, engine);
  let job = started;
  onStatus?.(job.status);

  while (job.status === "pending" || job.status === "running") {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise((r) => setTimeout(r, intervalMs));
    const prev = job.status;
    job = await getJob(job.job_id);
    if (job.status !== prev) onStatus?.(job.status);
  }

  if (job.status === "error" || !job.result) {
    throw new Error(job.error ?? "Transcription failed.");
  }
  return job.result;
}
