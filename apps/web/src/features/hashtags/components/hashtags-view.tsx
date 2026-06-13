"use client";

import * as React from "react";
import { Plus, Copy, Info, Loader2 } from "lucide-react";

import { useProfileReelsSearch } from "@/hooks/use-profile-reels-search";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { ToolPageShell } from "@/components/tool-page-shell";
import { UsernameSearchForm } from "@/components/username-search-form";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { hashtagsMeta } from "../meta";
import { analyzeHashtags } from "../lib/analyze";

export function HashtagsView() {
  const { username, setUsername, reels, isLoading, isLoadingMore, hasMore, loadMore, onSubmit } =
    useProfileReelsSearch();
  const { copy } = useCopyToClipboard();

  const analysis = React.useMemo(() => analyzeHashtags(reels), [reels]);

  const { stats, top, combos } = analysis;
  const maxCount = top[0]?.count ?? 1;
  // Heuristic for the "hashtags likely in first comment" caveat.
  const sparse = stats.posts > 0 && stats.postsWithTags / stats.posts < 0.4;

  return (
    <ToolPageShell
      icon={hashtagsMeta.icon}
      title={hashtagsMeta.name}
      description="See which hashtags an account uses most, and which they pair together."
      className="max-w-5xl"
    >
      <UsernameSearchForm
        value={username}
        onChange={setUsername}
        onSubmit={onSubmit}
        loading={isLoading}
        description="We analyze hashtags from the reels we can load (more reels = better signal)."
        buttonIcon={hashtagsMeta.icon}
        buttonLabel="Analyze"
      />

      {reels.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="reels analyzed" value={stats.posts} />
            <StatCard label="unique hashtags" value={stats.uniqueTags} />
            <StatCard label="avg hashtags / reel" value={stats.avgPerPost.toFixed(1)} />
            <StatCard label="avg caption length" value={stats.avgCaptionLength} />
          </div>

          {sparse && (
            <div className="text-muted-foreground mt-3 flex items-start gap-2 rounded-md border p-3 text-xs">
              <Info className="mt-0.5 size-4 shrink-0" />
              <span>
                Only {stats.postsWithTags} of {stats.posts} reels have hashtags in the
                caption. This account likely puts hashtags in the first comment, which
                isn&apos;t visible here — so these counts undercount their real usage.
              </span>
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Top hashtags</CardTitle>
                {top.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copy(top.slice(0, 30).map((t) => t.tag).join(" "), "Copied top hashtags")
                    }
                  >
                    <Copy className="size-3" /> Copy top 30
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {top.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No hashtags found in these captions.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {top.slice(0, 30).map((t) => (
                      <li key={t.tag} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copy(t.tag, `Copied ${t.tag}`)}
                          className="hover:bg-muted min-w-0 flex-1 truncate rounded px-1 text-left text-sm"
                          title="Click to copy"
                        >
                          {t.tag}
                        </button>
                        <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
                          <div
                            className="bg-foreground/60 h-full"
                            style={{ width: `${(t.count / maxCount) * 100}%` }}
                          />
                        </div>
                        <span className="text-muted-foreground w-16 text-right text-xs tabular-nums">
                          {t.count} · {t.pct.toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Common combinations</CardTitle>
                <CardDescription>Hashtags this account uses together.</CardDescription>
              </CardHeader>
              <CardContent>
                {combos.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Not enough repeated pairings yet — load more reels.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {combos.map((c) => (
                      <li key={`${c.a} ${c.b}`} className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-[10px]">{c.a}</Badge>
                        <span className="text-muted-foreground">+</span>
                        <Badge variant="secondary" className="text-[10px]">{c.b}</Badge>
                        <span className="text-muted-foreground ml-auto text-xs">×{c.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => loadMore()} disabled={isLoadingMore}>
                {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Load more reels (improves the analysis)
              </Button>
            </div>
          )}
        </>
      )}
    </ToolPageShell>
  );
}
