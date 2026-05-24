"use client";

import * as React from "react";
import { UserSearch, Loader2, Check, Play, Eye, Plus, Download } from "lucide-react";
import { toast } from "sonner";

import {
  fetchProfileReels,
  transcribeReel,
  downloadZip,
  type ReelSummary,
  type JobStatus,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HashtagChips } from "@/components/hashtag-chips";

type ReelState = {
  status: JobStatus | "idle";
  text?: string;
  error?: string;
};

const MAX_CONCURRENCY = 2; // be gentle: don't hammer Instagram / the CPU at once

function formatViews(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function ProfileReelsPage() {
  const [username, setUsername] = React.useState("");
  const [activeUser, setActiveUser] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [reels, setReels] = React.useState<ReelSummary[]>([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [states, setStates] = React.useState<Record<string, ReelState>>({});
  const [transcribing, setTranscribing] = React.useState(false);
  const [dlQuality, setDlQuality] = React.useState("best");
  const [downloading, setDownloading] = React.useState(false);

  async function handleFind(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().replace(/^@/, "");
    if (!u) return;

    setLoading(true);
    setReels([]);
    setSelected(new Set());
    setStates({});
    setCursor(null);
    setActiveUser(u);
    try {
      const res = await fetchProfileReels(u); // first page
      setReels(res.reels);
      setCursor(res.next_cursor);
      if (res.reels.length === 0) {
        toast.info(`No reels found for @${u}.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load that profile.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (!cursor || !activeUser) return;
    setLoadingMore(true);
    try {
      const res = await fetchProfileReels(activeUser, cursor);
      // De-dupe defensively in case Instagram repeats an item across pages.
      setReels((prev) => {
        const seen = new Set(prev.map((r) => r.shortcode));
        return [...prev, ...res.reels.filter((r) => !seen.has(r.shortcode))];
      });
      setCursor(res.next_cursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load more reels.");
    } finally {
      setLoadingMore(false);
    }
  }

  function toggle(shortcode: string) {
    if (transcribing || downloading) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(shortcode) ? next.delete(shortcode) : next.add(shortcode);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(reels.map((r) => r.shortcode)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function transcribeSelected() {
    const queue = reels.filter((r) => selected.has(r.shortcode));
    if (queue.length === 0) return;

    setTranscribing(true);
    setStates((s) => {
      const next = { ...s };
      for (const r of queue) next[r.shortcode] = { status: "pending" };
      return next;
    });

    const setOne = (shortcode: string, patch: ReelState) =>
      setStates((s) => ({ ...s, [shortcode]: patch }));

    // Simple concurrency-limited worker pool.
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
  }

  async function downloadSelected() {
    const urls = reels.filter((r) => selected.has(r.shortcode)).map((r) => r.url);
    if (urls.length === 0) return;
    setDownloading(true);
    toast.info(`Preparing a zip of ${urls.length} reel(s)… this can take a moment.`);
    try {
      await downloadZip(urls, dlQuality);
      toast.success("Download ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  const busy = transcribing || downloading;
  const doneCount = Object.values(states).filter((s) => s.status === "done").length;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <UserSearch className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Profile Reels</h1>
          <p className="text-muted-foreground text-sm">
            Find a user&apos;s reels, select the ones you want, and transcribe them.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instagram username</CardTitle>
          <CardDescription>Public accounts only (e.g. natgeo).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFind} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">
                @
              </span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                disabled={loading || transcribing}
                className="pl-7"
              />
            </div>
            <Button type="submit" disabled={loading || transcribing || !username.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <UserSearch className="size-4" />}
              {loading ? "Finding…" : "Find reels"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {reels.length > 0 && (
        <>
          <div className="my-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{reels.length} loaded</span>
            <span className="text-muted-foreground text-sm">
              · {selected.size} selected{doneCount ? ` · ${doneCount} done` : ""}
              {cursor ? " · more available" : ""}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} disabled={busy}>
                Select all
              </Button>
              <Button variant="outline" size="sm" onClick={clearSelection} disabled={busy}>
                Clear
              </Button>
              <select
                value={dlQuality}
                onChange={(e) => setDlQuality(e.target.value)}
                disabled={busy}
                className="border-input bg-background h-8 rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:outline-none"
                aria-label="Download quality"
              >
                <option value="best">Best</option>
                <option value="1080">1080p</option>
                <option value="720">720p</option>
                <option value="540">540p</option>
                <option value="360">360p</option>
                <option value="audio">Audio (MP3)</option>
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={downloadSelected}
                disabled={busy || selected.size === 0}
              >
                {downloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Download ({selected.size})
              </Button>
              <Button size="sm" onClick={transcribeSelected} disabled={busy || selected.size === 0}>
                {transcribing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Transcribing…
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> Transcribe ({selected.size})
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reels.map((reel) => {
              const isSelected = selected.has(reel.shortcode);
              const state = states[reel.shortcode];
              const views = formatViews(reel.view_count);
              return (
                <Card
                  key={reel.shortcode}
                  onClick={() => toggle(reel.shortcode)}
                  className={`cursor-pointer overflow-hidden p-0 transition-all ${
                    isSelected ? "ring-primary ring-2" : "hover:border-foreground/20"
                  }`}
                >
                  <div className="relative aspect-[9/16] max-h-64 w-full bg-muted">
                    {reel.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={reel.thumbnail_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    )}
                    <div
                      className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border-2 ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-white/80 bg-black/30"
                      }`}
                    >
                      {isSelected && <Check className="size-3.5" />}
                    </div>
                    {views && (
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
                        <Eye className="size-3" /> {views}
                      </div>
                    )}
                    {state && state.status !== "idle" && (
                      <div className="absolute left-2 top-2">
                        {state.status === "done" ? (
                          <Badge className="bg-green-600 text-white">Done</Badge>
                        ) : state.status === "error" ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <Loader2 className="size-3 animate-spin" />
                            {state.status}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {reel.caption || "(no caption)"}
                    </p>
                    {reel.hashtags.length > 0 && (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <HashtagChips hashtags={reel.hashtags} size="sm" />
                      </div>
                    )}
                    {state?.status === "done" && (
                      <p className="mt-2 max-h-28 overflow-y-auto rounded bg-muted p-2 text-xs">
                        {state.text || "(no speech detected)"}
                      </p>
                    )}
                    {state?.status === "error" && (
                      <p className="text-destructive mt-2 text-xs">{state.error}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {cursor && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore || transcribing}
              >
                {loadingMore ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
