"use client";

import * as React from "react";
import { Loader2, Play, Plus, Download } from "lucide-react";
import { toast } from "sonner";

import { ApiError, downloadZip } from "@/lib/api";
import { useProfileReelsSearch } from "@/hooks/use-profile-reels-search";
import { ToolPageShell } from "@/components/tool-page-shell";
import { UsernameSearchForm } from "@/components/username-search-form";
import { Button } from "@/components/ui/button";

import { profileMeta } from "../meta";
import { useBatchTranscribe } from "../hooks/use-batch-transcribe";
import { ReelCard } from "./reel-card";

export function ProfileView() {
  const { username, setUsername, activeUser, reels, isLoading, isLoadingMore, hasMore, loadMore, onSubmit } =
    useProfileReelsSearch();

  const { states, transcribing, run, reset } = useBatchTranscribe();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [dlQuality, setDlQuality] = React.useState("best");
  const [downloading, setDownloading] = React.useState(false);

  // A new search invalidates the per-reel selection/transcription state
  // (adjust-on-change during render, React's alternative to a reset effect).
  const [prevUser, setPrevUser] = React.useState(activeUser);
  if (activeUser !== prevUser) {
    setPrevUser(activeUser);
    setSelected(new Set());
    reset();
  }

  const busy = transcribing || downloading;

  function toggle(shortcode: string) {
    if (busy) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(shortcode)) next.delete(shortcode);
      else next.add(shortcode);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(reels.map((r) => r.shortcode)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  function transcribeSelected() {
    run(reels.filter((r) => selected.has(r.shortcode)));
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
      toast.error(err instanceof ApiError ? err.message : "Download failed.");
    } finally {
      setDownloading(false);
    }
  }

  const doneCount = Object.values(states).filter((s) => s.status === "done").length;

  return (
    <ToolPageShell
      icon={profileMeta.icon}
      title={profileMeta.name}
      description="Find a user's reels, select the ones you want, and transcribe them."
      className="max-w-5xl"
    >
      <UsernameSearchForm
        value={username}
        onChange={setUsername}
        onSubmit={onSubmit}
        loading={isLoading}
        disabled={transcribing}
        description="Public accounts only (e.g. natgeo)."
        buttonIcon={profileMeta.icon}
        buttonLabel="Find reels"
        loadingLabel="Finding…"
      />

      {reels.length > 0 && (
        <>
          <div className="my-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{reels.length} loaded</span>
            <span className="text-muted-foreground text-sm">
              · {selected.size} selected{doneCount ? ` · ${doneCount} done` : ""}
              {hasMore ? " · more available" : ""}
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
            {reels.map((reel) => (
              <ReelCard
                key={reel.shortcode}
                reel={reel}
                isSelected={selected.has(reel.shortcode)}
                state={states[reel.shortcode]}
                onToggle={() => toggle(reel.shortcode)}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => loadMore()}
                disabled={isLoadingMore || transcribing}
              >
                {isLoadingMore ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                {isLoadingMore ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </>
      )}
    </ToolPageShell>
  );
}
