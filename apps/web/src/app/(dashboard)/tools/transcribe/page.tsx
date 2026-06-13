"use client";

import * as React from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AudioLines, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  ApiError,
  startTranscription,
  type JobStatus,
} from "@/lib/api";
import { jobQuery } from "@/queries/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DownloadControl } from "@/components/download-control";
import { HashtagChips } from "@/components/hashtag-chips";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const INSTAGRAM_URL = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/i;

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Queued…",
  running: "Transcribing…",
  done: "Done",
  error: "Error",
};

export default function TranscribePage() {
  const [url, setUrl] = React.useState("");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);

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
  const result =
    jobQ.data?.status === "done" ? (jobQ.data.result ?? null) : null;

  // React to terminal job states once each.
  React.useEffect(() => {
    if (jobQ.data?.status === "error") {
      toast.error(jobQ.data.error ?? "Transcription failed.");
    } else if (jobQ.data?.status === "done" && !jobQ.data.result?.text?.trim()) {
      toast.info("Transcription finished, but no speech was detected.");
    }
  }, [jobQ.data?.status, jobQ.data?.error, jobQ.data?.result?.text]);

  // Debounce: only expose the download control (which fetches formats) once the
  // user has stopped typing a valid URL — avoids hammering the formats endpoint.
  // The state update lives in the timer callback (not the effect body) so it's
  // off the synchronous render path. Invalid input clears immediately (0ms).
  React.useEffect(() => {
    const trimmed = url.trim();
    const valid = INSTAGRAM_URL.test(trimmed);
    const t = setTimeout(() => setDownloadUrl(valid ? trimmed : null), valid ? 600 : 0);
    return () => clearTimeout(t);
  }, [url]);

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

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    toast.success("Transcript copied.");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <AudioLines className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reel Transcriber</h1>
          <p className="text-muted-foreground text-sm">
            Paste a public Instagram reel or post link to get its transcript.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reel link</CardTitle>
          <CardDescription>
            Works with public reels and video posts (instagram.com/reel/… or /p/…).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="url"
              inputMode="url"
              placeholder="https://www.instagram.com/reel/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isBusy}
              className="flex-1"
            />
            <Button type="submit" disabled={isBusy || !url.trim()}>
              {isBusy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {status ? STATUS_LABEL[status] : "Working…"}
                </>
              ) : (
                "Transcribe"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {downloadUrl && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Download this reel</CardTitle>
            <CardDescription>Pick a quality, or grab the audio only.</CardDescription>
          </CardHeader>
          <CardContent>
            <DownloadControl url={downloadUrl} />
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Transcript</CardTitle>
              {result.language && (
                <CardDescription>Detected language: {result.language}</CardDescription>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </CardHeader>
          <CardContent>
            <Textarea
              readOnly
              value={result.text || "(No speech detected in this reel.)"}
              className="min-h-48 resize-y"
            />
          </CardContent>
        </Card>
      )}

      {result && (result.caption || (result.hashtags && result.hashtags.length > 0)) && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Caption &amp; hashtags</CardTitle>
            <CardDescription>How this creator wrote the post.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.caption && (
              <Textarea readOnly value={result.caption} className="min-h-24 resize-y text-sm" />
            )}
            <HashtagChips hashtags={result.hashtags ?? []} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
