"use client";

import * as React from "react";
import { FileDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { fetchProfileReels, type ReelSummary } from "@/lib/api";
import { reelsToCsv, reelsToMarkdown, downloadText } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ExportPage() {
  const [username, setUsername] = React.useState("");
  const [activeUser, setActiveUser] = React.useState("");
  const [reels, setReels] = React.useState<ReelSummary[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

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

  function exportCsv() {
    downloadText(`${activeUser}-reels.csv`, reelsToCsv(reels), "text/csv");
    toast.success(`Exported ${reels.length} reels to CSV.`);
  }

  function exportMarkdown() {
    downloadText(`${activeUser}-reels.md`, reelsToMarkdown(reels), "text/markdown");
    toast.success(`Exported ${reels.length} reels to Markdown.`);
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <FileDown className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bulk Export</h1>
          <p className="text-muted-foreground text-sm">
            Export a profile&apos;s reels (link, date, views, hashtags, caption) to a file.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Instagram username</CardTitle>
          <CardDescription>Load reels, then export. Load more for a fuller dataset.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFind} className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 text-sm">@</span>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                disabled={loading}
                className="pl-7"
              />
            </div>
            <Button type="submit" disabled={loading || !username.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
              Load reels
            </Button>
          </form>
        </CardContent>
      </Card>

      {reels.length > 0 && (
        <Card className="mt-4">
          <CardContent className="flex flex-col gap-4 pt-6">
            <div className="text-sm">
              <span className="font-medium">{reels.length} reels</span>{" "}
              <span className="text-muted-foreground">loaded and ready to export.</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={exportCsv}>
                <FileDown className="size-4" /> Export CSV
              </Button>
              <Button variant="secondary" onClick={exportMarkdown}>
                <FileDown className="size-4" /> Export Markdown
              </Button>
              {cursor && (
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Load more
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
