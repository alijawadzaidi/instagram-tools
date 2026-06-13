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
import { DownloadControl } from "@/components/download-control";
import { HashtagChips } from "@/components/hashtag-chips";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { transcribeMeta } from "../meta";

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Queued…",
  running: "Transcribing…",
  done: "Done",
  error: "Error",
};

export function TranscribeView() {
  const [url, setUrl] = React.useState("");
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = React.useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();

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

  return (
    <ToolPageShell
      icon={transcribeMeta.icon}
      title={transcribeMeta.name}
      description="Paste a public Instagram reel or post link to get its transcript."
      className="max-w-3xl"
    >
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => copy(result.text, "Transcript copied.")}
            >
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
    </ToolPageShell>
  );
}
