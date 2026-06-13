/**
 * App-facing wrapper over the generated @repo/api-client. Types come from the
 * FastAPI OpenAPI schema (Pydantic is the single source of truth — Architecture
 * /04 Phase 3); this module only adds ergonomic names + a few browser helpers
 * (URL builders, blob download, start-and-poll). All requests go through the BFF
 * proxy and throw `ApiError` on failure.
 */

import {
  ApiError,
  API_BASE_URL,
  transcribeStart,
  transcribeStatus,
  profileListReels,
  profileInfo,
  downloadFormats,
  downloadCover,
  type TranscribeRequest,
  type TranscriptResult,
  type Segment,
  type JobResponse,
  type ReelSummaryModel,
  type ProfileReelsResponse,
  type ProfileInfoResponse,
  type CoverResponse,
  type QualityOption,
  type FormatsResponse,
} from "@repo/api-client";

import { downloadBlob } from "@/lib/download";

export { ApiError };

// Re-export the generated types under the names the app already uses.
export type TranscribeEngine = NonNullable<TranscribeRequest["engine"]>;
export type TranscriptSegment = Segment;
export type JobStatus = JobResponse["status"];
export type Job = JobResponse;
export type ReelSummary = ReelSummaryModel;
export type ProfileInfo = ProfileInfoResponse;
export type {
  TranscriptResult,
  ProfileReelsResponse,
  CoverResponse,
  QualityOption,
  FormatsResponse,
};

// --- transcription jobs ---

/** Start a transcription job. Returns immediately with a job id. */
export async function startTranscription(
  url: string,
  engine?: TranscribeEngine,
): Promise<Job> {
  const { data } = await transcribeStart({ body: { url, engine } });
  return data;
}

export async function getJob(jobId: string): Promise<Job> {
  const { data } = await transcribeStatus({ path: { job_id: jobId } });
  return data;
}

// --- profile reels ---

/**
 * Fetch one page of a user's reels. Omit `cursor` for the first page; pass the
 * `next_cursor` from the previous response to load the next page.
 */
export async function fetchProfileReels(
  username: string,
  cursor?: string | null,
  pageSize = 12,
): Promise<ProfileReelsResponse> {
  const { data } = await profileListReels({
    body: { username, cursor: cursor ?? null, page_size: pageSize },
  });
  return data;
}

// --- profile info (overview) ---

export async function fetchProfileInfo(username: string): Promise<ProfileInfo> {
  const { data } = await profileInfo({ body: { username } });
  return data;
}

// --- covers + images ---

export async function fetchCover(url: string): Promise<CoverResponse> {
  const { data } = await downloadCover({ body: { url } });
  return data;
}

/** GET url that streams an Instagram CDN image back as a download. */
export function imageDownloadUrl(url: string, filename: string): string {
  const q = new URLSearchParams({ url, filename });
  return `${API_BASE_URL}/tools/download/image?${q.toString()}`;
}

// --- downloads ---

export async function fetchFormats(url: string): Promise<FormatsResponse> {
  const { data } = await downloadFormats({ body: { url } });
  return data;
}

/** Direct GET url for a single-reel download (browser saves via Content-Disposition). */
export function downloadFileUrl(url: string, quality: string): string {
  const q = new URLSearchParams({ url, quality });
  return `${API_BASE_URL}/tools/download/file?${q.toString()}`;
}

/** Bulk download: POST urls, get a zip blob back, and save it. */
export async function downloadZip(urls: string[], quality: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/tools/download/zip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls, quality }),
  });
  if (!res.ok) {
    let code = "error";
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? body.detail ?? message;
      if (typeof body.code === "string") code = body.code;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(res.status, code, message);
  }
  downloadBlob("reels.zip", await res.blob(), "application/zip");
}

/**
 * Convenience: start a job and poll until it finishes (or errors). Calls
 * `onStatus` whenever the status changes so the UI can show progress. Used by
 * the profile batch-transcribe pool; single-reel flows use the jobQuery layer.
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

  let job = await startTranscription(url, engine);
  onStatus?.(job.status);

  while (job.status === "pending" || job.status === "running") {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise((r) => setTimeout(r, intervalMs));
    const prev = job.status;
    job = await getJob(job.job_id);
    if (job.status !== prev) onStatus?.(job.status);
  }

  if (job.status === "error" || !job.result) {
    throw new ApiError(0, job.error_code ?? "engine_error", job.error ?? "Transcription failed.");
  }
  return job.result;
}
