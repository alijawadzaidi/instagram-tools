"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

import { ApiError, startTranscription, type JobStatus } from "@/lib/api";
import { INSTAGRAM_URL } from "@/lib/instagram";
import { jobQuery } from "@/queries/jobs";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { ToolPageShell } from "@/components/tool-page-shell";
import { ReelUrlForm } from "@/components/reel-url-form";
import { HashtagChips } from "@/components/hashtag-chips";
import { InstagramImage } from "@/components/instagram-image";
import { Button } from "@/components/ui/button";

import { transcribeMeta } from "../meta";

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Queued…",
  running: "Transcribing…",
  done: "Done",
  error: "Error",
};

const LABEL = "text-muted-foreground text-xs font-semibold uppercase tracking-wider";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The caption with its hashtags removed, so the chips below aren't a duplicate. */
function captionWithoutHashtags(caption: string, hashtags: string[]): string {
  let body = caption;
  // Longest-first so "#ai" can't partially clip "#aitools" (the \b guards too).
  for (const tag of [...hashtags].sort((a, b) => b.length - a.length)) {
    body = body.replace(new RegExp(escapeRegExp(tag) + "\\b", "gi"), "");
  }
  return body
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

function reelShortcode(url: string): string | null {
  return url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

export function TranscribeView() {
  const [url, setUrl] = React.useState("");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const transcriptCopy = useCopyToClipboard();
  const captionCopy = useCopyToClipboard();

  // POST to start the job; the polling query (below) takes over from its id.
  const startJob = useMutation({
    mutationFn: (reelUrl: string) => startTranscription(reelUrl),
    onSuccess: (job) => setJobId(job.job_id),
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Something went wrong."),
  });

  const jobQ = useQuery(jobQuery(jobId));

  const status: JobStatus | null = startJob.isPending
    ? "pending"
    : (jobQ.data?.status ?? null);
  const isBusy = status === "pending" || status === "running";
  const result = jobQ.data?.status === "done" ? (jobQ.data.result ?? null) : null;

  // React to terminal job states once each.
  React.useEffect(() => {
    if (jobQ.data?.status === "error") {
      toast.error(jobQ.data.error ?? "Transcription failed.");
    } else if (jobQ.data?.status === "done" && !jobQ.data.result?.text?.trim()) {
      toast.info("Transcription finished, but no speech was detected.");
    }
  }, [jobQ.data?.status, jobQ.data?.error, jobQ.data?.result?.text]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!INSTAGRAM_URL.test(trimmed)) {
      toast.error("That doesn't look like an Instagram reel/post link.");
      return;
    }
    setJobId(null);
    startJob.mutate(trimmed);
  }

  const caption = result ? captionWithoutHashtags(result.caption ?? "", result.hashtags ?? []) : "";
  const hashtags = result?.hashtags ?? [];
  const words = result ? wordCount(result.text) : 0;
  const shortcode = reelShortcode(url);
  const title = caption.split("\n")[0] || "Reel transcript";

  return (
    <ToolPageShell className="max-w-5xl">
      <ReelUrlForm
        value={url}
        onChange={setUrl}
        onSubmit={handleSubmit}
        loading={isBusy}
        cardTitle="Reel link"
        description="Works with public reels and video posts (instagram.com/reel/… or /p/…)."
        buttonIcon={transcribeMeta.icon}
        buttonLabel="Transcribe"
        loadingLabel={status ? STATUS_LABEL[status] : "Working…"}
      />

      {result && (
        <div className="border-hairline bg-card mt-4 border">
          {/* reel context — anchors the result */}
          <div className="border-hairline flex items-center justify-between gap-4 border-b px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              {result.cover ? (
                <InstagramImage
                  src={result.cover}
                  alt=""
                  className="size-12 flex-none rounded-md object-cover"
                />
              ) : (
                <div className="bg-soft-cloud text-muted-foreground flex size-12 flex-none items-center justify-center rounded-md text-sm">
                  ▶
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{title}</p>
                {shortcode && (
                  <p className="text-muted-foreground truncate text-xs">
                    instagram.com/reel/{shortcode}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-none flex-wrap justify-end gap-1.5">
              {result.language && (
                <span className="bg-soft-cloud text-muted-foreground rounded-full px-3 py-1 text-xs">
                  {result.language}
                </span>
              )}
              {words > 0 && (
                <span className="bg-soft-cloud text-muted-foreground rounded-full px-3 py-1 text-xs">
                  {words} words
                </span>
              )}
            </div>
          </div>

          {/* transcript */}
          <section className="border-hairline border-b px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className={LABEL}>Transcript</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => transcriptCopy.copy(result.text, "Transcript copied.")}
              >
                {transcriptCopy.copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {transcriptCopy.copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {result.text || "(No speech detected in this reel.)"}
            </p>
          </section>

          {/* caption (hashtags stripped — they live in the chips below) */}
          {caption && (
            <section className="border-hairline border-b px-5 py-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className={LABEL}>Caption</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => captionCopy.copy(caption, "Caption copied.")}
                >
                  {captionCopy.copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {captionCopy.copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{caption}</p>
            </section>
          )}

          {/* hashtags — shown once, as chips with their own copy-all */}
          {hashtags.length > 0 && (
            <section className="px-5 py-4">
              <h3 className={`${LABEL} mb-2`}>Hashtags · {hashtags.length}</h3>
              <HashtagChips hashtags={hashtags} />
            </section>
          )}
        </div>
      )}
    </ToolPageShell>
  );
}
