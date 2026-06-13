"use client";

import * as React from "react";
import { TrendingUp, Loader2, Plus, Eye, ExternalLink } from "lucide-react";

import { useProfileReelsSearch } from "@/hooks/use-profile-reels-search";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function compact(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

export default function RankingPage() {
  const {
    username,
    setUsername,
    reels,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    onSubmit,
  } = useProfileReelsSearch();

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
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Top Reels</h1>
          <p className="text-muted-foreground text-sm">
            Rank an account&apos;s reels by views to see what performs best.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instagram username</CardTitle>
          <CardDescription>Ranks the reels we can load (load more for a bigger picture).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">@</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                disabled={isLoading}
                className="pl-7"
              />
            </div>
            <Button type="submit" disabled={isLoading || !username.trim()}>
              {isLoading ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
              Rank
            </Button>
          </form>
        </CardContent>
      </Card>

      {reels.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="reels ranked" value={String(ranked.counted)} />
            <Stat label="avg views" value={compact(Math.round(ranked.avg))} />
            <Stat label="median views" value={compact(ranked.median)} />
            <Stat label="top views" value={compact(ranked.max)} />
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
                  {reel.thumbnail_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={reel.thumbnail_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-16 w-12 shrink-0 rounded object-cover"
                    />
                  )}
                  <span className="text-muted-foreground line-clamp-2 min-w-0 flex-1 text-xs">
                    {reel.caption || "(no caption)"}
                  </span>
                  <span
                    className={`flex shrink-0 items-center gap-1 text-sm font-medium tabular-nums ${
                      aboveAvg ? "text-green-600 dark:text-green-500" : ""
                    }`}
                  >
                    <Eye className="size-3.5" />
                    {compact(reel.view_count)}
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
    </div>
  );
}
