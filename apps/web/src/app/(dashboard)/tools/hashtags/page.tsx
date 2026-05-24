"use client";

import * as React from "react";
import { Hash, Loader2, Plus, Copy, Info } from "lucide-react";
import { toast } from "sonner";

import { fetchProfileReels, type ReelSummary } from "@/lib/api";
import { analyzeHashtags } from "@/lib/hashtags";
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}

export default function HashtagResearchPage() {
  const [username, setUsername] = React.useState("");
  const [activeUser, setActiveUser] = React.useState("");
  const [reels, setReels] = React.useState<ReelSummary[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const analysis = React.useMemo(() => analyzeHashtags(reels), [reels]);

  async function handleFind(e: React.FormEvent) {
    e.preventDefault();
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    setLoading(true);
    setReels([]);
    setCursor(null);
    setActiveUser(u);
    try {
      const res = await fetchProfileReels(u);
      setReels(res.reels);
      setCursor(res.next_cursor);
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
      setReels((prev) => {
        const seen = new Set(prev.map((r) => r.shortcode));
        return [...prev, ...res.reels.filter((r) => !seen.has(r.shortcode))];
      });
      setCursor(res.next_cursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function copyTop(n: number) {
    const tags = analysis.top.slice(0, n).map((t) => t.tag);
    if (tags.length === 0) return;
    await navigator.clipboard.writeText(tags.join(" "));
    toast.success(`Copied top ${tags.length} hashtags`);
  }

  async function copyTag(tag: string) {
    await navigator.clipboard.writeText(tag);
    toast.success(`Copied ${tag}`);
  }

  const { stats, top, combos } = analysis;
  const maxCount = top[0]?.count ?? 1;
  // Heuristic for the "hashtags likely in first comment" caveat.
  const sparse = stats.posts > 0 && stats.postsWithTags / stats.posts < 0.4;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <Hash className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Hashtag Research</h1>
          <p className="text-muted-foreground text-sm">
            See which hashtags an account uses most, and which they pair together.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instagram username</CardTitle>
          <CardDescription>
            We analyze hashtags from the reels we can load (more reels = better signal).
          </CardDescription>
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
                disabled={loading}
                className="pl-7"
              />
            </div>
            <Button type="submit" disabled={loading || !username.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Hash className="size-4" />}
              Analyze
            </Button>
          </form>
        </CardContent>
      </Card>

      {reels.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="reels analyzed" value={stats.posts} />
            <Stat label="unique hashtags" value={stats.uniqueTags} />
            <Stat label="avg hashtags / reel" value={stats.avgPerPost.toFixed(1)} />
            <Stat label="avg caption length" value={stats.avgCaptionLength} />
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
                  <Button variant="outline" size="sm" onClick={() => copyTop(30)}>
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
                          onClick={() => copyTag(t.tag)}
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

          {cursor && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Load more reels (improves the analysis)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
