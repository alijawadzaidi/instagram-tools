"use client";

import * as React from "react";
import { Loader2, Plus, Eye, ExternalLink } from "lucide-react";

import { formatCompact } from "@/lib/format";
import { useProfileReelsSearch } from "@/hooks/use-profile-reels-search";
import { ToolPageShell } from "@/components/tool-page-shell";
import { UsernameSearchForm } from "@/components/username-search-form";
import { InstagramImage } from "@/components/instagram-image";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";

import { rankingMeta } from "../meta";

export function RankingView() {
  const { username, setUsername, reels, isLoading, isLoadingMore, hasMore, loadMore, onSubmit } =
    useProfileReelsSearch();

  const ranked = React.useMemo(() => {
    const withViews = reels.filter((r) => r.view_count != null);
    const sorted = [...reels].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
    const views = withViews.map((r) => r.view_count as number).sort((a, b) => a - b);
    const total = views.reduce((s, v) => s + v, 0);
    const avg = views.length ? total / views.length : 0;
    const median = views.length ? views[Math.floor(views.length / 2)] : 0;
    const max = views.length ? views[views.length - 1] : 0;
    return { sorted, avg, median, max, counted: views.length };
  }, [reels]);

  return (
    <ToolPageShell
      icon={rankingMeta.icon}
      title={rankingMeta.name}
      description="Rank an account's reels by views to see what performs best."
      className="max-w-3xl"
    >
      <UsernameSearchForm
        value={username}
        onChange={setUsername}
        onSubmit={onSubmit}
        loading={isLoading}
        description="Ranks the reels we can load (load more for a bigger picture)."
        buttonIcon={rankingMeta.icon}
        buttonLabel="Rank"
      />

      {reels.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="reels ranked" value={String(ranked.counted)} />
            <StatCard label="avg views" value={formatCompact(Math.round(ranked.avg))} />
            <StatCard label="median views" value={formatCompact(ranked.median)} />
            <StatCard label="top views" value={formatCompact(ranked.max)} />
          </div>

          <div className="mt-4 space-y-2">
            {ranked.sorted.map((reel, i) => {
              const aboveAvg = (reel.view_count ?? 0) >= ranked.avg && ranked.avg > 0;
              return (
                <a
                  key={reel.shortcode}
                  href={reel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:bg-muted/50 flex items-center gap-3 rounded-lg border p-2"
                >
                  <span className="text-muted-foreground w-6 text-center text-sm tabular-nums">
                    {i + 1}
                  </span>
                  <InstagramImage
                    src={reel.thumbnail_url}
                    className="h-16 w-12 shrink-0 rounded object-cover"
                  />
                  <span className="text-muted-foreground line-clamp-2 min-w-0 flex-1 text-xs">
                    {reel.caption || "(no caption)"}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums ${
                      aboveAvg ? "text-positive" : ""
                    }`}
                  >
                    <Eye className="size-3.5" />
                    {formatCompact(reel.view_count)}
                  </span>
                  <ExternalLink className="text-muted-foreground size-3.5 shrink-0" />
                </a>
              );
            })}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Load more reels
              </Button>
            </div>
          )}
        </>
      )}
    </ToolPageShell>
  );
}
