"use client";

import { FileDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { useProfileReelsSearch } from "@/hooks/use-profile-reels-search";
import { ToolPageShell } from "@/components/tool-page-shell";
import { UsernameSearchForm } from "@/components/username-search-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { exportMeta } from "../meta";
import { reelsToCsv, reelsToMarkdown, downloadText } from "../lib/serializers";

export function ExportView() {
  const { username, setUsername, activeUser, reels, isLoading, isLoadingMore, hasMore, loadMore, onSubmit } =
    useProfileReelsSearch();

  function exportCsv() {
    downloadText(`${activeUser}-reels.csv`, reelsToCsv(reels), "text/csv");
    toast.success(`Exported ${reels.length} reels to CSV.`);
  }

  function exportMarkdown() {
    downloadText(`${activeUser}-reels.md`, reelsToMarkdown(reels), "text/markdown");
    toast.success(`Exported ${reels.length} reels to Markdown.`);
  }

  return (
    <ToolPageShell
      className="max-w-2xl"
    >
      <UsernameSearchForm
        value={username}
        onChange={setUsername}
        onSubmit={onSubmit}
        loading={isLoading}
        description="Load reels, then export. Load more for a fuller dataset."
        buttonIcon={exportMeta.icon}
        buttonLabel="Load reels"
      />

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
              {hasMore && (
                <Button variant="outline" onClick={() => loadMore()} disabled={isLoadingMore}>
                  {isLoadingMore ? (
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
    </ToolPageShell>
  );
}
