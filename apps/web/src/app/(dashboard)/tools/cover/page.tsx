"use client";

import * as React from "react";
import { Image as ImageIcon, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

import { fetchCover, imageDownloadUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const INSTAGRAM_URL = /^https?:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/i;

export default function CoverDownloaderPage() {
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [cover, setCover] = React.useState<{ shortcode: string; coverUrl: string } | null>(null);

  async function handleFind(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!INSTAGRAM_URL.test(trimmed)) {
      toast.error("That doesn't look like an Instagram reel/post link.");
      return;
    }
    setLoading(true);
    setCover(null);
    try {
      const res = await fetchCover(trimmed);
      if (!res.cover_url) {
        toast.error("Couldn't find a cover for this reel.");
        return;
      }
      setCover({ shortcode: res.shortcode, coverUrl: res.cover_url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't fetch the cover.");
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!cover) return;
    const a = document.createElement("a");
    a.href = imageDownloadUrl(cover.coverUrl, `cover-${cover.shortcode}.jpg`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.info("Downloading cover…");
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="bg-muted flex size-10 items-center justify-center rounded-lg">
          <ImageIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Cover Downloader</h1>
          <p className="text-muted-foreground text-sm">
            Grab the full-resolution cover image of any reel or post.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reel link</CardTitle>
          <CardDescription>Paste a public reel or post URL.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFind} className="flex flex-col gap-3 sm:flex-row">
            <Input
              type="url"
              placeholder="https://www.instagram.com/reel/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || !url.trim()}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <ImageIcon className="size-4" />}
              Get cover
            </Button>
          </form>
        </CardContent>
      </Card>

      {cover && (
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.coverUrl}
              alt="Reel cover"
              referrerPolicy="no-referrer"
              className="max-h-[60vh] w-auto rounded-lg border"
            />
            <Button onClick={download}>
              <Download className="size-4" /> Download cover
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
