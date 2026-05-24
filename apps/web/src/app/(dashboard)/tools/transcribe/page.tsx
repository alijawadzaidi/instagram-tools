"use client";

import * as React from "react";
import { AudioLines, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  transcribeReel,
  type JobStatus,
  type TranscriptResult,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  const [status, setStatus] = React.useState<JobStatus | null>(null);
  const [result, setResult] = React.useState<TranscriptResult | null>(null);
  const [copied, setCopied] = React.useState(false);

  const isBusy = status === "pending" || status === "running";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!INSTAGRAM_URL.test(trimmed)) {
      toast.error("That doesn't look like an Instagram reel/post link.");
      return;
    }

    setResult(null);
    setStatus("pending");
    try {
      const res = await transcribeReel(trimmed, { onStatus: setStatus });
      setResult(res);
      setStatus("done");
      if (!res.text.trim()) {
        toast.info("Transcription finished, but no speech was detected.");
      }
    } catch (err) {
      setStatus("error");
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    }
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
    </div>
  );
}
