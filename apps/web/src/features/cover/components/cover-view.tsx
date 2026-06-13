"use client";

import * as React from "react";
import { useMutation } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { ApiError, fetchCover, imageDownloadUrl } from "@/lib/api";
import { INSTAGRAM_URL } from "@/lib/instagram";
import { triggerBrowserDownload } from "@/lib/download";
import { ToolPageShell } from "@/components/tool-page-shell";
import { ReelUrlForm } from "@/components/reel-url-form";
import { InstagramImage } from "@/components/instagram-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { coverMeta } from "../meta";

export function CoverView() {
  const [url, setUrl] = React.useState("");

  const getCover = useMutation({
    mutationFn: (reelUrl: string) => fetchCover(reelUrl),
    onSuccess: (res) => {
      if (!res.cover_url) toast.error("Couldn't find a cover for this reel.");
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : "Couldn't fetch the cover."),
  });

  const cover =
    getCover.data?.cover_url != null
      ? { shortcode: getCover.data.shortcode, coverUrl: getCover.data.cover_url }
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!INSTAGRAM_URL.test(trimmed)) {
      toast.error("That doesn't look like an Instagram reel/post link.");
      return;
    }
    getCover.mutate(trimmed);
  }

  function download() {
    if (!cover) return;
    triggerBrowserDownload(
      imageDownloadUrl(cover.coverUrl, `cover-${cover.shortcode}.jpg`),
    );
    toast.info("Downloading cover…");
  }

  return (
    <ToolPageShell
      icon={coverMeta.icon}
      title={coverMeta.name}
      description="Grab the full-resolution cover image of any reel or post."
      className="max-w-2xl"
    >
      <ReelUrlForm
        value={url}
        onChange={setUrl}
        onSubmit={handleSubmit}
        loading={getCover.isPending}
        cardTitle="Reel link"
        description="Paste a public reel or post URL."
        buttonIcon={coverMeta.icon}
        buttonLabel="Get cover"
      />

      {cover && (
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <InstagramImage
              src={cover.coverUrl}
              alt="Reel cover"
              className="max-h-[60vh] w-auto rounded-lg border"
            />
            <Button onClick={download}>
              <Download className="size-4" /> Download cover
            </Button>
          </CardContent>
        </Card>
      )}
    </ToolPageShell>
  );
}
